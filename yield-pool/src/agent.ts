import { z } from "zod";
import {
  AgentKitConfig,
  createAgentApp,
} from "@lucid-dreams/agent-kit";
import { monitoringService } from "./runtime";
import { watcherConfigSchema } from "./config";
import type { AlertEvent, DeltaSnapshot, PoolMetrics } from "./types";
import { normaliseJson } from "./utils/json";

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

const snapshotFilterSchema = z.object({
  protocolId: z.string().optional(),
  poolId: z.string().optional(),
  alertLimit: z.number().int().positive().max(500).optional(),
});

const alertsFilterSchema = z.object({
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
  input: watcherConfigSchema,
  output: z.object({
    protocolIds: z.array(z.string()),
    pools: z.array(configuredPoolOutputSchema),
    thresholdRules: z.array(
      z.object({
        id: z.string(),
        metric: z.enum(["tvl", "apy"]),
      })
    ),
    pollingIntervalMs: z.number().int().positive().optional(),
  }),
  async handler({ input }) {
    const config = monitoringService.configure(input);
    return {
      output: {
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
    const { protocolId, poolId, alertLimit } = input ?? {};
    const baseFilter = { protocolId, poolId };
    const metrics = monitoringService.getMetrics(baseFilter);
    const deltas = monitoringService.getDeltas(baseFilter);
    const alerts = monitoringService.getAlerts({
      ...baseFilter,
      limit: alertLimit,
    });

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
    const alerts = monitoringService.getAlerts(input ?? {});
    return {
      output: {
        alerts: serialiseAlerts(alerts),
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
