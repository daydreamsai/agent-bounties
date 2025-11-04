import { z } from "zod";
import {
  AgentKitConfig,
  createAgentApp,
} from "@lucid-dreams/agent-kit";
import { llmService, monitoringService } from "./runtime";
import { watcherConfigSchema } from "./config";
import type { AlertEvent, DeltaSnapshot, PoolMetrics } from "./types";
import { normaliseJson } from "./utils/json";
import {
  buildWatcherSummaryData,
  buildFallbackWatcherSummaryText,
} from "./utils/analytics";

const configOverrides: AgentKitConfig = {
  payments: {
    facilitatorUrl:
      (process.env.FACILITATOR_URL as any) ??
      "https://facilitator.daydreams.systems",
    payTo:
      (process.env.PAY_TO as `0x${string}`) ??
      "0xb308ed39d67D0d4BAe5BC2FAEF60c66BBb6AE429",
    network: (process.env.NETWORK as any) ?? "base",
    defaultPrice: process.env.DEFAULT_PRICE ?? "0.1",
  },
};

const { app, addEntrypoint } = createAgentApp(
  {
    name: "yield-pool-watcher",
    version: "0.1.0",
    description:
      "Tracks APY and TVL across configured pools and emits alerts on sharp changes.",
  },
  {
    config: configOverrides,
  }
);

const watcherIdSchema = z
  .string()
  .min(1, { message: "watcherId is required. Use wallet address or custom identifier." });

const configureWatcherInputSchema = z.object({
  watcherId: watcherIdSchema,
  config: watcherConfigSchema,
});

const snapshotFilterSchema = z.object({
  watcherId: watcherIdSchema,
  protocolId: z.string().optional(),
  poolId: z.string().optional(),
  alertLimit: z.number().int().positive().max(500).optional(),
});

const alertsFilterSchema = z.object({
  watcherId: watcherIdSchema,
  protocolId: z.string().optional(),
  poolId: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

const poolMetricOutputSchema = z.object({
  protocolId: z.string(),
  poolId: z.string(),
  chainId: z.number(),
  address: z.string(),
  blockNumber: z.string().optional(),
  timestamp: z.number(),
  apy: z.number().nullable().optional(),
  tvl: z.number().nullable().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

const deltaOutputSchema = z.object({
  protocolId: z.string(),
  poolId: z.string(),
  metric: z.enum(["tvl", "apy"]),
  previous: z.number().nullable().optional(),
  current: z.number().nullable().optional(),
  absoluteChange: z.number().nullable().optional(),
  percentChange: z.number().nullable().optional(),
  timestamp: z.number(),
  blockNumber: z.string().optional(),
});

const alertOutputSchema = z.object({
  id: z.string(),
  protocolId: z.string(),
  poolId: z.string(),
  metric: z.enum(["tvl", "apy"]),
  ruleId: z.string(),
  triggeredAt: z.number(),
  blockNumber: z.string().optional(),
  changeDirection: z.enum(["increase", "decrease"]),
  changeAmount: z.number().nullable().optional(),
  percentChange: z.number().nullable().optional(),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const configuredPoolOutputSchema = z.object({
  protocolId: z.string(),
  poolId: z.string(),
  chainId: z.number(),
});

const metricChangeStatsSchema = z.object({
  dataPoints: z.number().int(),
  largestIncreasePercent: z.number().nullable(),
  largestDecreasePercent: z.number().nullable(),
  cumulativeAbsoluteChange: z.number().nullable(),
  lastChangePercent: z.number().nullable(),
  lastChangeAmount: z.number().nullable(),
});

const alertSummarySchema = z.object({
  id: z.string(),
  protocolId: z.string(),
  poolId: z.string(),
  metric: z.enum(["tvl", "apy"]),
  ruleId: z.string(),
  triggeredAt: z.number(),
  changeDirection: z.enum(["increase", "decrease"]),
  changeAmount: z.number().nullable().optional(),
  percentChange: z.number().nullable().optional(),
  message: z.string(),
  blockNumber: z.string().optional(),
});

const poolWatcherSummarySchema = z.object({
  protocolId: z.string(),
  poolId: z.string(),
  chainId: z.number(),
  address: z.string().optional(),
  currentMetrics: z
    .object({
      tvl: z.number().nullable().optional(),
      apy: z.number().nullable().optional(),
      timestamp: z.number().optional(),
      blockNumber: z.string().optional(),
    })
    .optional(),
  tvlStats: metricChangeStatsSchema.optional(),
  apyStats: metricChangeStatsSchema.optional(),
  recentAlerts: z.array(alertSummarySchema).optional(),
});

const watcherSummaryDataSchema = z.object({
  generatedAt: z.string(),
  timeframeHours: z.number(),
  watcherConfig: z.object({
    protocolIds: z.array(z.string()),
    pools: z.array(
      z.object({
        id: z.string(),
        protocolId: z.string(),
        chainId: z.number(),
        address: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    ),
    thresholdRules: z.array(
      z.object({
        id: z.string(),
        metric: z.enum(["tvl", "apy"]),
        change: z.object({
          type: z.enum(["percent", "absolute"]),
          direction: z.enum(["increase", "decrease", "both"]),
          amount: z.number(),
        }),
        window: z.object({
          type: z.enum(["blocks", "minutes"]),
          value: z.number(),
        }),
        metadata: z.record(z.string(), z.unknown()).optional(),
        appliesTo: z
          .object({
            protocolIds: z.array(z.string()).optional(),
            poolIds: z.array(z.string()).optional(),
          })
          .optional(),
      })
    ),
  }),
  pools: z.array(poolWatcherSummarySchema),
  alertTotals: z.object({
    totalAlerts24h: z.number().int(),
    byRule: z.array(
      z.object({
        ruleId: z.string(),
        count: z.number().int(),
      })
    ),
  }),
});

const watcherSummaryResultSchema = z.object({
  summary: z.string(),
  data: watcherSummaryDataSchema,
  llm: z
    .object({
      provider: z.string(),
      model: z.string(),
    })
    .optional(),
});

const watcherSummaryInputSchema = z.object({
  watcherId: watcherIdSchema,
  timeframeHours: z.number().int().min(1).max(168).optional(),
  maxRecentAlerts: z.number().int().min(1).max(20).optional(),
});

const topYieldInputSchema = z.object({
  watcherId: watcherIdSchema,
  chainId: z.number().int().positive(),
  limit: z.number().int().positive().max(50).optional(),
  minTvlUsd: z.number().nonnegative().optional(),
  sortBy: z.enum(["apy", "tvl"]).optional(),
});

const topYieldOutputSchema = z.object({
  results: z.array(
    z.object({
      protocolId: z.string(),
      poolId: z.string(),
      chainId: z.number(),
      apy: z.number().nullable().optional(),
      tvl: z.number().nullable().optional(),
      timestamp: z.number().optional(),
      blockNumber: z.string().optional(),
    })
  ),
});

function serialiseMetrics(metrics: PoolMetrics[]): z.infer<typeof poolMetricOutputSchema>[] {
  return metrics.map((metric) => ({
    protocolId: metric.protocolId,
    poolId: metric.poolId,
    chainId: metric.chainId,
    address: metric.address,
    blockNumber:
      metric.blockNumber !== undefined && metric.blockNumber !== null
        ? String(metric.blockNumber)
        : undefined,
    timestamp: metric.timestamp,
    apy: metric.apy ?? null,
    tvl: metric.tvl ?? null,
    raw: metric.raw
      ? (normaliseJson(metric.raw) as Record<string, unknown>)
      : undefined,
  }));
}

function serialiseDeltas(deltas: DeltaSnapshot[]): z.infer<typeof deltaOutputSchema>[] {
  return deltas.map((delta) => ({
    protocolId: delta.protocolId,
    poolId: delta.poolId,
    metric: delta.metric,
    previous: delta.previous ?? null,
    current: delta.current ?? null,
    absoluteChange: delta.absoluteChange ?? null,
    percentChange: delta.percentChange ?? null,
    timestamp: delta.timestamp,
    blockNumber:
      delta.blockNumber !== undefined && delta.blockNumber !== null
        ? String(delta.blockNumber)
        : undefined,
  }));
}

function serialiseAlerts(alerts: AlertEvent[]): z.infer<typeof alertOutputSchema>[] {
  return alerts.map((alert) => ({
    id: alert.id,
    protocolId: alert.protocolId,
    poolId: alert.poolId,
    metric: alert.metric,
    ruleId: alert.ruleId,
    triggeredAt: alert.triggeredAt,
    blockNumber:
      alert.blockNumber !== undefined && alert.blockNumber !== null
        ? String(alert.blockNumber)
        : undefined,
    changeDirection: alert.changeDirection,
    changeAmount: alert.changeAmount ?? null,
    percentChange: alert.percentChange ?? null,
    message: alert.message,
    metadata: alert.metadata
      ? (normaliseJson(alert.metadata) as Record<string, unknown>)
      : undefined,
  }));
}

addEntrypoint({
  key: "configure-watcher",
  description:
    "Configure the yield pool watcher with protocol, pool, and threshold rules.",
  input: configureWatcherInputSchema,
  output: z.object({
    watcherId: z.string(),
    protocolIds: z.array(z.string()),
    pools: z.array(configuredPoolOutputSchema),
    thresholdRules: z.array(
      z.object({
        id: z.string(),
        metric: z.enum(["tvl", "apy"]),
      })
    ),
    pollingIntervalMs: z.number().int().positive().optional(),
    configVersion: z.number().int().positive(),
  }),
  async handler({ input }) {
    const { watcherId, config: configInput } = input;
    const { config, version } = await monitoringService.configure(
      watcherId,
      configInput
    );
    return {
      output: {
        watcherId,
        protocolIds: config.protocolIds,
        pools: config.pools.map((pool) => ({
          protocolId: pool.protocolId,
          poolId: pool.id,
          chainId: pool.chainId,
        })),
        thresholdRules: config.thresholdRules.map((rule) => ({
          id: rule.id,
          metric: rule.metric,
        })),
        pollingIntervalMs: config.pollingIntervalMs,
        configVersion: version,
      },
    };
  },
});

addEntrypoint({
  key: "get-snapshot",
  description:
    "Fetch the latest pool metrics, deltas, and alerts for the configured watcher.",
  input: snapshotFilterSchema,
  output: z.object({
    pool_metrics: z.array(poolMetricOutputSchema),
    deltas: z.array(deltaOutputSchema),
    alerts: z.array(alertOutputSchema),
  }),
  async handler({ input }) {
    const { watcherId, protocolId, poolId, alertLimit } = input;
    const baseFilter = { protocolId, poolId };
    const [metrics, deltas, alerts] = await Promise.all([
      monitoringService.getMetrics(watcherId, baseFilter),
      monitoringService.getDeltas(watcherId, baseFilter),
      monitoringService.getAlerts(watcherId, {
        ...baseFilter,
        limit: alertLimit,
      }),
    ]);

    return {
      output: {
        pool_metrics: serialiseMetrics(metrics),
        deltas: serialiseDeltas(deltas),
        alerts: serialiseAlerts(alerts),
      },
    };
  },
});

addEntrypoint({
  key: "get-alerts",
  description:
    "Return recent alert events emitted by the watcher, optionally filtered.",
  input: alertsFilterSchema,
  output: z.object({
    alerts: z.array(alertOutputSchema),
  }),
  async handler({ input }) {
    const { watcherId, protocolId, poolId, limit } = input;
    const alerts = await monitoringService.getAlerts(watcherId, {
      protocolId,
      poolId,
      limit,
    });
    return {
      output: {
        alerts: serialiseAlerts(alerts),
      },
    };
  },
});

addEntrypoint({
  key: "summarize-watcher",
  description:
    "Summarize configured watcher preferences and highlight changes over the selected timeframe using an LLM when available.",
  input: watcherSummaryInputSchema,
  output: watcherSummaryResultSchema,
  async handler({ input }) {
    const watcherId = input.watcherId;
    const timeframeHours = input.timeframeHours ?? 24;
    const maxRecentAlerts = input.maxRecentAlerts ?? 5;
    const since = Date.now() - timeframeHours * 60 * 60 * 1000;

    const config = await monitoringService.getConfig(watcherId);
    if (!config) {
      const emptySummary: z.infer<typeof watcherSummaryDataSchema> = {
        generatedAt: new Date().toISOString(),
        timeframeHours,
        watcherConfig: {
          protocolIds: [],
          pools: [],
          thresholdRules: [],
        },
        pools: [],
        alertTotals: {
          totalAlerts24h: 0,
          byRule: [],
        },
      };

      return {
        output: {
          summary:
            "Watcher is not configured. Configure the watcher before requesting summaries.",
          data: emptySummary,
        },
      };
    }

    const [metrics, deltas, alerts] = await Promise.all([
      monitoringService.getMetrics(watcherId),
      monitoringService.getDeltas(watcherId),
      monitoringService.getAlerts(watcherId, {
        limit: Math.max(100, maxRecentAlerts * 5),
      }),
    ]);

    const filteredDeltas = deltas.filter((delta) => delta.timestamp >= since);
    const filteredAlerts = alerts.filter(
      (alert) => alert.triggeredAt >= since
    );

    const summaryDataRaw = buildWatcherSummaryData({
      config,
      metrics,
      deltas: filteredDeltas,
      alerts: filteredAlerts,
      sinceTimestamp: since,
      maxRecentAlertsPerPool: maxRecentAlerts,
      timeframeHours,
    });

    const summaryData = normaliseJson(summaryDataRaw);
    let summaryText = buildFallbackWatcherSummaryText(summaryDataRaw);
    let llmMetadata: { provider: string; model: string } | undefined;

    if (llmService.isEnabled()) {
      try {
        summaryText = await llmService.summarizeWatcher(summaryData);
        llmMetadata = {
          provider: llmService.provider,
          model: llmService.model,
        };
      } catch (error) {
        console.error("[llm] Summary generation failed:", error);
        summaryText = buildFallbackWatcherSummaryText(summaryDataRaw);
      }
    }

    return {
      output: {
        summary: summaryText,
        data: summaryData,
        ...(llmMetadata ? { llm: llmMetadata } : {}),
      },
    };
  },
});

addEntrypoint({
  key: "find-top-yields",
  description:
    "Return the highest-yielding pools currently tracked on a given chain.",
  input: topYieldInputSchema,
  output: topYieldOutputSchema,
  async handler({ input }) {
    const {
      watcherId,
      chainId,
      limit = 5,
      minTvlUsd = 0,
      sortBy = "apy",
    } = input;

    const metrics = await monitoringService.getMetrics(watcherId);
    const filtered = metrics.filter((metric) => {
      if (metric.chainId !== chainId) {
        return false;
      }
      if (
        minTvlUsd > 0 &&
        (metric.tvl === null ||
          metric.tvl === undefined ||
          metric.tvl < minTvlUsd)
      ) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const metricA =
        sortBy === "tvl"
          ? a.tvl ?? Number.NEGATIVE_INFINITY
          : a.apy ?? Number.NEGATIVE_INFINITY;
      const metricB =
        sortBy === "tvl"
          ? b.tvl ?? Number.NEGATIVE_INFINITY
          : b.apy ?? Number.NEGATIVE_INFINITY;
      return Number(metricB) - Number(metricA);
    });

    const results = sorted.slice(0, limit).map((metric) => ({
      protocolId: metric.protocolId,
      poolId: metric.poolId,
      chainId: metric.chainId,
      apy: metric.apy ?? null,
      tvl: metric.tvl ?? null,
      timestamp: metric.timestamp,
      blockNumber:
        metric.blockNumber !== undefined && metric.blockNumber !== null
          ? String(metric.blockNumber)
          : undefined,
    }));

    return {
      output: {
        results,
      },
    };
  },
});

addEntrypoint({
  key: "health",
  description: "Report the current health of the monitoring service.",
  input: z.object({}),
  output: z.object({
    status: z.enum(["ok", "unconfigured", "stopped"]),
    pollingIntervalMs: z.number(),
    activePools: z.number().int().nonnegative(),
    configuredProtocols: z.number().int().nonnegative(),
    lastRunAt: z.number().optional(),
  }),
  async handler() {
    const health = monitoringService.getHealth();
    return {
      output: health,
    };
  },
});

export { app };
