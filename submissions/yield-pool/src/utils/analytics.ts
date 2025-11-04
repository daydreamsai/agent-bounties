import type { WatcherConfig } from "../config";
import type { AlertEvent, DeltaSnapshot, PoolMetrics } from "../types";

export interface MetricChangeStats {
  dataPoints: number;
  largestIncreasePercent: number | null;
  largestDecreasePercent: number | null;
  cumulativeAbsoluteChange: number | null;
  lastChangePercent: number | null;
  lastChangeAmount: number | null;
}

export interface AlertSummary {
  id: string;
  protocolId: string;
  poolId: string;
  metric: AlertEvent["metric"];
  ruleId: string;
  triggeredAt: number;
  changeDirection: AlertEvent["changeDirection"];
  changeAmount: number | null | undefined;
  percentChange: number | null | undefined;
  message: string;
  blockNumber?: string;
}

export interface PoolWatcherSummary {
  protocolId: string;
  poolId: string;
  chainId: number;
  address?: string;
  currentMetrics?: {
    tvl?: number | null;
    apy?: number | null;
    timestamp?: number;
    blockNumber?: string;
  };
  tvlStats?: MetricChangeStats;
  apyStats?: MetricChangeStats;
  recentAlerts?: AlertSummary[];
}

export interface WatcherSummaryData {
  generatedAt: string;
  timeframeHours: number;
  watcherConfig: {
    protocolIds: WatcherConfig["protocolIds"];
    pools: WatcherConfig["pools"];
    thresholdRules: WatcherConfig["thresholdRules"];
  };
  pools: PoolWatcherSummary[];
  alertTotals: {
    totalAlerts24h: number;
    byRule: Array<{ ruleId: string; count: number }>;
  };
}

interface BuildWatcherSummaryArgs {
  config: WatcherConfig;
  metrics: PoolMetrics[];
  deltas: DeltaSnapshot[];
  alerts: AlertEvent[];
  sinceTimestamp: number;
  maxRecentAlertsPerPool: number;
  timeframeHours: number;
}

export function buildWatcherSummaryData({
  config,
  metrics,
  deltas,
  alerts,
  sinceTimestamp,
  maxRecentAlertsPerPool,
  timeframeHours,
}: BuildWatcherSummaryArgs): WatcherSummaryData {
  const alerts24h = alerts.filter((alert) => alert.triggeredAt >= sinceTimestamp);
  const alertsByRule = aggregateAlertCounts(alerts24h);

  const poolSummaries = config.pools.map((pool) => {
    const latestMetrics = metrics.find(
      (metric) =>
        metric.protocolId.toLowerCase() === pool.protocolId.toLowerCase() &&
        metric.poolId.toLowerCase() === pool.id.toLowerCase()
    );

    const poolDeltas = deltas.filter(
      (delta) =>
        delta.timestamp >= sinceTimestamp &&
        delta.protocolId.toLowerCase() === pool.protocolId.toLowerCase() &&
        delta.poolId.toLowerCase() === pool.id.toLowerCase()
    );

    const tvlStats = computeMetricStats(poolDeltas.filter((delta) => delta.metric === "tvl"));
    const apyStats = computeMetricStats(poolDeltas.filter((delta) => delta.metric === "apy"));

    const recentAlerts = alerts24h
      .filter(
        (alert) =>
          alert.protocolId.toLowerCase() === pool.protocolId.toLowerCase() &&
          alert.poolId.toLowerCase() === pool.id.toLowerCase()
      )
      .sort((a, b) => a.triggeredAt - b.triggeredAt)
      .slice(-maxRecentAlertsPerPool)
      .map<AlertSummary>((alert) => ({
        id: alert.id,
        protocolId: alert.protocolId,
        poolId: alert.poolId,
        metric: alert.metric,
        ruleId: alert.ruleId,
        triggeredAt: alert.triggeredAt,
        changeDirection: alert.changeDirection,
        changeAmount: alert.changeAmount,
        percentChange: alert.percentChange,
        message: alert.message,
        blockNumber:
          alert.blockNumber !== undefined && alert.blockNumber !== null
            ? String(alert.blockNumber)
            : undefined,
      }));

    return {
      protocolId: pool.protocolId,
      poolId: pool.id,
      chainId: pool.chainId,
      address: pool.address,
      currentMetrics: latestMetrics
        ? {
            tvl: latestMetrics.tvl ?? null,
            apy: latestMetrics.apy ?? null,
            timestamp: latestMetrics.timestamp,
            blockNumber:
              latestMetrics.blockNumber !== undefined && latestMetrics.blockNumber !== null
                ? String(latestMetrics.blockNumber)
                : undefined,
          }
        : undefined,
      tvlStats,
      apyStats,
      recentAlerts,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    timeframeHours,
    watcherConfig: {
      protocolIds: config.protocolIds,
      pools: config.pools,
      thresholdRules: config.thresholdRules,
    },
    pools: poolSummaries,
    alertTotals: {
      totalAlerts24h: alerts24h.length,
      byRule: alertsByRule,
    },
  };
}

export function buildFallbackWatcherSummaryText(data: WatcherSummaryData): string {
  const lines: string[] = [];
  const poolCount = data.watcherConfig.pools.length;
  const ruleCount = data.watcherConfig.thresholdRules.length;
  lines.push(
    `Watcher is monitoring ${poolCount} pool${poolCount === 1 ? "" : "s"} across ${
      data.watcherConfig.protocolIds.length
    } protoc${data.watcherConfig.protocolIds.length === 1 ? "ol" : "ols"}.`
  );
  lines.push(
    `There ${
      ruleCount === 1 ? "is" : "are"
    } ${ruleCount} threshold rule${ruleCount === 1 ? "" : "s"} configured (e.g. ${
      data.watcherConfig.thresholdRules
        .map((rule) => `${rule.metric} ${rule.change.direction} ${rule.change.amount}${rule.change.type === "percent" ? "%" : ""}`)
        .slice(0, 2)
        .join("; ") || "n/a"
    }).`
  );
  lines.push(
    `Last ${data.timeframeHours}h: ${data.alertTotals.totalAlerts24h} alert${
      data.alertTotals.totalAlerts24h === 1 ? "" : "s"
    } fired.`
  );

  for (const pool of data.pools) {
    const apyNow =
      pool.currentMetrics?.apy !== undefined && pool.currentMetrics?.apy !== null
        ? `${pool.currentMetrics.apy.toFixed(2)}%`
        : "n/a";
    const tvlNow =
      pool.currentMetrics?.tvl !== undefined && pool.currentMetrics?.tvl !== null
        ? `$${(pool.currentMetrics.tvl / 1_000_000).toFixed(2)}M`
        : "n/a";

    const apyBump =
      pool.apyStats?.largestIncreasePercent !== null && pool.apyStats?.largestIncreasePercent !== undefined
        ? `max Δ ${pool.apyStats.largestIncreasePercent!.toFixed(3)}%`
        : null;
    const tvlSwing =
      pool.tvlStats?.largestIncreasePercent !== null && pool.tvlStats?.largestIncreasePercent !== undefined
        ? `max TVL Δ ${pool.tvlStats.largestIncreasePercent!.toFixed(3)}%`
        : null;

    const recentAlert = pool.recentAlerts?.slice(-1)[0];
    const alertSnippet = recentAlert
      ? `Latest alert: ${recentAlert.metric} ${recentAlert.changeDirection} ${recentAlert.percentChange?.toFixed(3) ?? "n/a"}%`
      : "No alerts";

    const highlights = [apyBump, tvlSwing, alertSnippet].filter(Boolean).join(" | ");
    lines.push(
      `• ${pool.protocolId}/${pool.poolId} (chain ${pool.chainId}) – APY ${apyNow}, TVL ${tvlNow}. ${highlights || ""}`.trim()
    );
  }

  return lines.join("\n");
}

function computeMetricStats(deltas: DeltaSnapshot[]): MetricChangeStats | undefined {
  if (!deltas.length) {
    return undefined;
  }
  const percentChanges = deltas
    .map((delta) => (delta.percentChange !== null && delta.percentChange !== undefined ? delta.percentChange : null))
    .filter((value): value is number => value !== null);
  const absoluteChanges = deltas
    .map((delta) => (delta.absoluteChange !== null && delta.absoluteChange !== undefined ? delta.absoluteChange : null))
    .filter((value): value is number => value !== null);

  const lastDelta = deltas[deltas.length - 1];

  return {
    dataPoints: deltas.length,
    largestIncreasePercent: percentChanges.length ? Math.max(...percentChanges) : null,
    largestDecreasePercent: percentChanges.length ? Math.min(...percentChanges) : null,
    cumulativeAbsoluteChange: absoluteChanges.length
      ? absoluteChanges.reduce((acc, value) => acc + Math.abs(value), 0)
      : null,
    lastChangePercent:
      lastDelta.percentChange !== null && lastDelta.percentChange !== undefined
        ? lastDelta.percentChange
        : null,
    lastChangeAmount:
      lastDelta.absoluteChange !== null && lastDelta.absoluteChange !== undefined
        ? lastDelta.absoluteChange
        : null,
  };
}

function aggregateAlertCounts(alerts: AlertEvent[]): Array<{ ruleId: string; count: number }> {
  const counts = new Map<string, number>();
  for (const alert of alerts) {
    counts.set(alert.ruleId, (counts.get(alert.ruleId) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([ruleId, count]) => ({ ruleId, count }));
}
