import {
  WatcherConfig,
  WatcherConfigInput,
  watcherConfigSchema,
} from "../config";
import { getProtocolAdapter } from "../protocols";
import { PostgresWatcherRepository, WatcherRow } from "../storage/postgres";
import {
  AlertEvent,
  DeltaSnapshot,
  MetricKind,
  NumericMetric,
  PoolMetrics,
} from "../types";

const DEFAULT_POLLING_INTERVAL_MS = 12_000;
const ALERT_ID_PREFIX = "alert";

export interface MetricsFilter {
  protocolId?: string;
  poolId?: string;
}

export interface AlertsFilter extends MetricsFilter {
  limit?: number;
}

export interface HealthStatus {
  status: "ok" | "unconfigured" | "stopped";
  watchers: number;
  pollingIntervalMs: number;
  configuredPools: number;
  configuredProtocols: number;
  lastRunAt?: number;
}

export class MonitoringService {
  private readonly repository: PostgresWatcherRepository;
  private readonly defaultPollingIntervalMs: number;
  private pollingHandle: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isPolling = false;

  constructor(
    repository: PostgresWatcherRepository,
    options?: { defaultPollingIntervalMs?: number }
  ) {
    this.repository = repository;
    this.defaultPollingIntervalMs =
      options?.defaultPollingIntervalMs ?? DEFAULT_POLLING_INTERVAL_MS;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.pollingHandle = setInterval(
      () => void this.tick(),
      Math.min(this.defaultPollingIntervalMs, 5_000)
    );
    void this.tick();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollingHandle) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = null;
    }
  }

  async configure(
    watcherAddress: string,
    input: WatcherConfigInput
  ): Promise<{ watcher: WatcherRow; config: WatcherConfig; version: number }> {
    const config = watcherConfigSchema.parse(input);
    const watcher = await this.repository.ensureWatcher(
      watcherAddress,
      config.pollingIntervalMs ?? null
    );

    await this.repository.resetWatcherState(watcher.watcher_id);
    const { version } = await this.repository.saveWatcherConfig(
      watcher.watcher_id,
      config
    );

    // Trigger an immediate poll asynchronously.
    void this.pollWatcher(watcher, config);

    return { watcher, config, version };
  }

  async getConfig(watcherAddress: string): Promise<WatcherConfig | null> {
    const watcher = await this.repository.getWatcherByAddress(watcherAddress);
    if (!watcher) return null;
    const latest = await this.repository.getLatestConfig(watcher.watcher_id);
    return latest?.config ?? null;
  }

  async getMetrics(
    watcherAddress: string,
    filter?: MetricsFilter
  ): Promise<PoolMetrics[]> {
    const watcher = await this.repository.getWatcherByAddress(watcherAddress);
    if (!watcher) return [];
    const config = await this.repository.getLatestConfig(watcher.watcher_id);
    if (!config) return [];

    const metrics = await this.repository.getLatestMetrics(
      watcher.watcher_id,
      filter
    );
    return this.applyPoolMetadata(metrics, config.config);
  }

  async getDeltas(
    watcherAddress: string,
    filter?: MetricsFilter
  ): Promise<DeltaSnapshot[]> {
    const watcher = await this.repository.getWatcherByAddress(watcherAddress);
    if (!watcher) return [];
    return this.repository.getDeltas(watcher.watcher_id, filter);
  }

  async getAlerts(
    watcherAddress: string,
    filter?: AlertsFilter
  ): Promise<AlertEvent[]> {
    const watcher = await this.repository.getWatcherByAddress(watcherAddress);
    if (!watcher) return [];
    return this.repository.getAlerts(watcher.watcher_id, filter);
  }

  async getHealth(): Promise<HealthStatus> {
    if (!this.isRunning) {
      return {
        status: "stopped",
        watchers: 0,
        pollingIntervalMs: this.defaultPollingIntervalMs,
        configuredPools: 0,
        configuredProtocols: 0,
      };
    }

    const entries = await this.repository.listActiveWatchersWithConfig();
    if (!entries.length) {
      return {
        status: "unconfigured",
        watchers: 0,
        pollingIntervalMs: this.defaultPollingIntervalMs,
        configuredPools: 0,
        configuredProtocols: 0,
      };
    }

    const pools = entries.reduce(
      (acc, entry) => acc + (entry.config?.pools.length ?? 0),
      0
    );
    const protocols = new Set<string>();
    for (const entry of entries) {
      entry.config?.protocolIds.forEach((id) =>
        protocols.add(id.toLowerCase())
      );
    }
    const lastRun = entries
      .map((entry) => entry.watcher.last_run_at?.getTime() ?? 0)
      .reduce((max, value) => Math.max(max, value), 0);

    return {
      status: "ok",
      watchers: entries.length,
      pollingIntervalMs: this.defaultPollingIntervalMs,
      configuredPools: pools,
      configuredProtocols: protocols.size,
      lastRunAt: lastRun || undefined,
    };
  }

  private async tick(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      await this.pollDueWatchers();
    } catch (error) {
      console.error("[monitoring] polling loop failed:", error);
    } finally {
      this.isPolling = false;
    }
  }

  private async pollDueWatchers(): Promise<void> {
    const entries = await this.repository.listActiveWatchersWithConfig();
    if (!entries.length) return;

    const now = Date.now();

    for (const entry of entries) {
      if (!entry.config) continue;
      const interval =
        entry.config.pollingIntervalMs ??
        entry.watcher.polling_interval_ms ??
        this.defaultPollingIntervalMs;
      const lastRun = entry.watcher.last_run_at?.getTime() ?? 0;
      if (now - lastRun < interval) {
        continue;
      }
      await this.pollWatcher(entry.watcher, entry.config);
    }
  }

  private async pollWatcher(
    watcher: WatcherRow,
    config: WatcherConfig
  ): Promise<void> {
    if (!config.pools.length) {
      await this.repository.updateWatcherRunState(
        watcher.watcher_id,
        new Date()
      );
      return;
    }

    const currentTimestamp = Date.now();
    const previousMap = await this.repository.getLatestMetricsMap(
      watcher.watcher_id
    );
    const collectedMetrics: PoolMetrics[] = [];

    for (const pool of config.pools) {
      const adapter = getProtocolAdapter(pool.protocolId);
      if (!adapter) {
        console.warn(
          `[monitoring] No adapter for protocol ${pool.protocolId} (pool ${pool.id})`
        );
        continue;
      }

      try {
        const metrics = await adapter.fetchLatestMetrics(pool, {
          timestamp: currentTimestamp,
        });
        if (metrics) {
          collectedMetrics.push(metrics);
        }
      } catch (error) {
        console.error(
          `[monitoring] Failed to fetch metrics for ${pool.protocolId}/${pool.id}:`,
          error
        );
      }
    }

    if (!collectedMetrics.length) {
      await this.repository.updateWatcherRunState(
        watcher.watcher_id,
        new Date(currentTimestamp)
      );
      return;
    }

    const deltas: DeltaSnapshot[] = [];
    const alerts: AlertEvent[] = [];

    for (const metrics of collectedMetrics) {
      const key = this.metricKey(metrics.protocolId, metrics.poolId);
      const previous = previousMap.get(key) ?? null;
      if (previous && !previous.address) {
        previous.address = this.lookupPoolAddress(config, metrics);
      }

      const metricDeltas = this.computeDeltas(previous, metrics);
      deltas.push(...metricDeltas);

      const triggered = this.evaluateAlerts(
        metricDeltas,
        metrics,
        previous,
        config.thresholdRules
      );
      alerts.push(...triggered);
    }

    await this.repository.insertMetrics(watcher, collectedMetrics);
    await this.repository.insertDeltas(watcher, deltas);
    await this.repository.insertAlerts(watcher, alerts);
    await this.repository.updateWatcherRunState(
      watcher.watcher_id,
      new Date(currentTimestamp)
    );
  }

  private metricKey(protocolId: string, poolId: string): string {
    return `${protocolId.toLowerCase()}::${poolId.toLowerCase()}`;
  }

  private applyPoolMetadata(
    metrics: PoolMetrics[],
    config: WatcherConfig
  ): PoolMetrics[] {
    if (!metrics.length) return metrics;
    const poolLookup = new Map<string, WatcherConfig["pools"][number]>();
    for (const pool of config.pools) {
      poolLookup.set(this.metricKey(pool.protocolId, pool.id), pool);
    }
    return metrics.map((metric) => {
      const pool = poolLookup.get(this.metricKey(metric.protocolId, metric.poolId));
      if (!pool) return metric;
      return {
        ...metric,
        address: pool.address as `0x${string}`,
      };
    });
  }

  private lookupPoolAddress(
    config: WatcherConfig,
    metrics: PoolMetrics
  ): `0x${string}` {
    const pool = config.pools.find(
      (p) =>
        p.protocolId.toLowerCase() === metrics.protocolId.toLowerCase() &&
        p.id.toLowerCase() === metrics.poolId.toLowerCase()
    );
    return (pool?.address ?? metrics.address) as `0x${string}`;
  }

  private computeDeltas(
    previous: PoolMetrics | null,
    current: PoolMetrics
  ): DeltaSnapshot[] {
    if (!previous) {
      return [];
    }

    const results: DeltaSnapshot[] = [];

    const metricsToCompare: Array<{
      kind: MetricKind;
      previousValue: NumericMetric;
      currentValue: NumericMetric;
    }> = [
      { kind: "tvl", previousValue: previous.tvl, currentValue: current.tvl },
      { kind: "apy", previousValue: previous.apy, currentValue: current.apy },
    ];

    for (const { kind, previousValue, currentValue } of metricsToCompare) {
      const delta = this.calculateDelta(kind, previousValue, currentValue, current);
      if (delta) {
        results.push(delta);
      }
    }

    return results;
  }

  private calculateDelta(
    kind: MetricKind,
    previous: NumericMetric,
    current: NumericMetric,
    metrics: PoolMetrics
  ): DeltaSnapshot | null {
    if (previous === null || previous === undefined) return null;
    if (current === null || current === undefined) return null;

    const absoluteChange = current - previous;
    const percentChange =
      previous !== 0 ? (absoluteChange / previous) * 100 : null;

    return {
      protocolId: metrics.protocolId,
      poolId: metrics.poolId,
      metric: kind,
      previous,
      current,
      absoluteChange,
      percentChange,
      timestamp: metrics.timestamp,
      blockNumber: metrics.blockNumber,
    };
  }

  private evaluateAlerts(
    deltas: DeltaSnapshot[],
    current: PoolMetrics,
    previous: PoolMetrics | null,
    rules: WatcherConfig["thresholdRules"]
  ): AlertEvent[] {
    if (!deltas.length || !rules.length || !previous) {
      return [];
    }

    const alerts: AlertEvent[] = [];

    for (const delta of deltas) {
      for (const rule of rules) {
        if (!this.ruleApplies(rule, current)) continue;
        const changeDirection =
          (delta.absoluteChange ?? 0) >= 0 ? "increase" : "decrease";
        if (
          rule.change.direction !== "both" &&
          rule.change.direction !== changeDirection
        ) {
          continue;
        }

        if (rule.metric !== delta.metric) continue;

        const meetsThreshold = this.checkThreshold(rule, delta);
        if (!meetsThreshold) continue;

        alerts.push({
          id: this.buildAlertId(rule.id, current),
          protocolId: current.protocolId,
          poolId: current.poolId,
          metric: delta.metric,
          ruleId: rule.id,
          triggeredAt: Date.now(),
          blockNumber: current.blockNumber,
          changeDirection,
          changeAmount: delta.absoluteChange,
          percentChange: delta.percentChange,
          message: this.generateAlertMessage(rule, current, delta),
          metadata: {
            rule,
            previous,
            current,
          },
        });
      }
    }

    return alerts;
  }

  private ruleApplies(
    rule: WatcherConfig["thresholdRules"][number],
    metrics: PoolMetrics
  ): boolean {
    if (!rule.appliesTo) return true;
    if (rule.appliesTo.protocolIds) {
      const match = rule.appliesTo.protocolIds.some(
        (id) => id.toLowerCase() === metrics.protocolId.toLowerCase()
      );
      if (!match) return false;
    }
    if (rule.appliesTo.poolIds) {
      const match = rule.appliesTo.poolIds.some(
        (id) => id.toLowerCase() === metrics.poolId.toLowerCase()
      );
      if (!match) return false;
    }
    return true;
  }

  private checkThreshold(
    rule: WatcherConfig["thresholdRules"][number],
    delta: DeltaSnapshot
  ): boolean {
    if (rule.change.type === "percent") {
      if (delta.percentChange === null || delta.percentChange === undefined) {
        return false;
      }
      return Math.abs(delta.percentChange) >= rule.change.amount;
    }

    if (delta.absoluteChange === null || delta.absoluteChange === undefined) {
      return false;
    }
    return Math.abs(delta.absoluteChange) >= rule.change.amount;
  }

  private buildAlertId(
    ruleId: string,
    metrics: PoolMetrics
  ): string {
    const segments = [
      ALERT_ID_PREFIX,
      ruleId,
      metrics.protocolId,
      metrics.poolId,
      metrics.blockNumber ?? Date.now(),
    ];
    return segments.join("::");
  }

  private generateAlertMessage(
    rule: WatcherConfig["thresholdRules"][number],
    metrics: PoolMetrics,
    delta: DeltaSnapshot
  ): string {
    const change =
      rule.change.type === "percent"
        ? `${delta.percentChange?.toFixed(2)}%`
        : delta.absoluteChange?.toLocaleString();
    return `Rule ${rule.id} triggered on ${metrics.protocolId}/${metrics.poolId} for ${rule.metric} (${change ?? "n/a"})`;
  }
}
