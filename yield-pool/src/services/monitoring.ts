import {
  WatcherConfig,
  WatcherConfigInput,
  watcherConfigSchema,
} from "../config";
import { getProtocolAdapter } from "../protocols";
import type { WatcherStore } from "../storage/in-memory";
import {
  AlertEvent,
  DeltaSnapshot,
  MetricKind,
  PoolMetrics,
  NumericMetric,
} from "../types";

const DEFAULT_POLLING_INTERVAL_MS = 12_000;
const ALERT_ID_PREFIX = "alert";

export interface MonitoringServiceOptions {
  defaultPollingIntervalMs?: number;
}

export interface MetricsFilter {
  protocolId?: string;
  poolId?: string;
}

export interface AlertsFilter extends MetricsFilter {
  limit?: number;
}

export interface HealthStatus {
  status: "ok" | "unconfigured" | "stopped";
  pollingIntervalMs: number;
  lastRunAt?: number;
  activePools: number;
  configuredProtocols: number;
}

export class MonitoringService {
  private readonly store: WatcherStore;
  private readonly defaultPollingIntervalMs: number;
  private pollingHandle: ReturnType<typeof setInterval> | null = null;
  private lastRunAt?: number;
  private isRunning = false;
  private isPolling = false;

  constructor(store: WatcherStore, options?: MonitoringServiceOptions) {
    this.store = store;
    this.defaultPollingIntervalMs =
      options?.defaultPollingIntervalMs ?? DEFAULT_POLLING_INTERVAL_MS;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.startPollingLoop();
    // Kick off an initial run without waiting for the first interval.
    this.tick();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollingHandle) {
      clearInterval(this.pollingHandle);
      this.pollingHandle = null;
    }
  }

  configure(input: WatcherConfigInput): WatcherConfig {
    const config = watcherConfigSchema.parse(input);
    this.store.setConfig(config);
    this.store.resetState();

    if (this.isRunning) {
      this.restartPollingLoop();
    }

    return config;
  }

  getConfig(): WatcherConfig | null {
    return this.store.getConfig();
  }

  async runOnce(): Promise<void> {
    await this.tick();
  }

  getMetrics(filter?: MetricsFilter): PoolMetrics[] {
    const all = this.store.getMetrics();
    if (!filter) {
      return all;
    }
    return all.filter((metric) => {
      if (filter.protocolId) {
        if (
          metric.protocolId.toLowerCase() !== filter.protocolId.toLowerCase()
        ) {
          return false;
        }
      }
      if (filter.poolId) {
        if (metric.poolId.toLowerCase() !== filter.poolId.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }

  getDeltas(filter?: MetricsFilter): DeltaSnapshot[] {
    const all = this.store.getDeltas();
    if (!filter) {
      return all;
    }
    return all.filter((delta) => {
      if (filter.protocolId) {
        if (
          delta.protocolId.toLowerCase() !== filter.protocolId.toLowerCase()
        ) {
          return false;
        }
      }
      if (filter.poolId) {
        if (delta.poolId.toLowerCase() !== filter.poolId.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }

  getAlerts(filter?: AlertsFilter): AlertEvent[] {
    let alerts = this.store.getAlerts();
    if (filter?.protocolId) {
      alerts = alerts.filter(
        (alert) =>
          alert.protocolId.toLowerCase() === filter.protocolId!.toLowerCase()
      );
    }
    if (filter?.poolId) {
      alerts = alerts.filter(
        (alert) => alert.poolId.toLowerCase() === filter.poolId!.toLowerCase()
      );
    }
    if (filter?.limit !== undefined) {
      alerts = alerts.slice(-filter.limit);
    }
    return alerts;
  }

  getHealth(): HealthStatus {
    const config = this.store.getConfig();
    if (!this.isRunning) {
      return {
        status: "stopped",
        pollingIntervalMs: config?.pollingIntervalMs ?? this.defaultPollingIntervalMs,
        activePools: config?.pools?.length ?? 0,
        configuredProtocols: config?.protocolIds?.length ?? 0,
        lastRunAt: this.lastRunAt,
      };
    }
    if (!config) {
      return {
        status: "unconfigured",
        pollingIntervalMs: this.defaultPollingIntervalMs,
        activePools: 0,
        configuredProtocols: 0,
        lastRunAt: this.lastRunAt,
      };
    }

    return {
      status: "ok",
      pollingIntervalMs: config.pollingIntervalMs ?? this.defaultPollingIntervalMs,
      activePools: config.pools.length,
      configuredProtocols: config.protocolIds.length,
      lastRunAt: this.lastRunAt,
    };
  }

  private startPollingLoop(): void {
    const interval = this.resolvePollingInterval();
    if (this.pollingHandle) {
      clearInterval(this.pollingHandle);
    }
    this.pollingHandle = setInterval(() => this.tick(), interval);
  }

  private restartPollingLoop(): void {
    if (!this.isRunning) {
      return;
    }
    this.startPollingLoop();
  }

  private resolvePollingInterval(): number {
    const config = this.store.getConfig();
    return config?.pollingIntervalMs ?? this.defaultPollingIntervalMs;
  }

  private async tick(): Promise<void> {
    if (this.isPolling) {
      return;
    }
    this.isPolling = true;
    try {
      await this.poll();
    } catch (error) {
      console.error("[monitoring] Polling cycle failed:", error);
    } finally {
      this.isPolling = false;
    }
  }

  private async poll(): Promise<void> {
    const config = this.store.getConfig();
    if (!config) {
      return;
    }

    const currentTimestamp = Date.now();
    const collectedMetrics: PoolMetrics[] = [];

    for (const pool of config.pools) {
      const adapter = getProtocolAdapter(pool.protocolId);
      if (!adapter) {
        console.warn(
          `[monitoring] No adapter found for protocol ${pool.protocolId} (pool: ${pool.id}).`
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
      this.lastRunAt = currentTimestamp;
      return;
    }

    const deltas: DeltaSnapshot[] = [];
    const alerts: AlertEvent[] = [];

    for (const metric of collectedMetrics) {
      const previous = this.store.getMetric(metric.protocolId, metric.poolId);
      const metricDeltas = this.computeDeltas(previous, metric);
      deltas.push(...metricDeltas);

      const triggered = this.evaluateAlerts(
        metricDeltas,
        metric,
        previous,
        config.thresholdRules
      );
      alerts.push(...triggered);
    }

    this.store.upsertMetrics(collectedMetrics);
    this.store.appendDeltas(deltas);
    this.store.appendAlerts(alerts);
    this.lastRunAt = currentTimestamp;
  }

  private computeDeltas(
    previous: PoolMetrics | null,
    current: PoolMetrics
  ): DeltaSnapshot[] {
    const results: DeltaSnapshot[] = [];

    const metricsToCompare: Array<{
      kind: MetricKind;
      previousValue: NumericMetric;
      currentValue: NumericMetric;
    }> = [
      { kind: "tvl", previousValue: previous?.tvl, currentValue: current.tvl },
      { kind: "apy", previousValue: previous?.apy, currentValue: current.apy },
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
    if (previous === null || previous === undefined) {
      return null;
    }
    if (current === null || current === undefined) {
      return null;
    }

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
        if (!this.ruleApplies(rule, current)) {
          continue;
        }

        const changeDirection =
          (delta.absoluteChange ?? 0) >= 0 ? "increase" : "decrease";

        if (
          rule.change.direction !== "both" &&
          rule.change.direction !== changeDirection
        ) {
          continue;
        }

        if (rule.metric !== delta.metric) {
          continue;
        }

        const meetsThreshold = this.checkThreshold(rule, delta);
        if (!meetsThreshold) {
          continue;
        }

        alerts.push({
          id: this.buildAlertId(rule.id, current, delta),
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

  private ruleApplies(rule: WatcherConfig["thresholdRules"][number], metrics: PoolMetrics): boolean {
    if (!rule.appliesTo) {
      return true;
    }
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
    metrics: PoolMetrics,
    delta: DeltaSnapshot
  ): string {
    const segments = [
      ALERT_ID_PREFIX,
      ruleId,
      metrics.protocolId,
      metrics.poolId,
      metrics.blockNumber ?? this.lastRunAt ?? Date.now(),
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
