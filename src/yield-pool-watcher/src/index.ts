/**
 * Yield Pool Watcher — DeFi yield monitoring agent.
 *
 * Tracks APY and TVL across yield pools and emits alerts
 * when metrics change beyond configurable thresholds.
 *
 * Entrypoints:
 *   - watch-pools: Monitor specific pools and return current metrics
 *   - check-alerts: Compare metrics against thresholds and return triggered alerts
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "yield-pool-watcher",
  version: "0.1.0",
  description: "Track APY and TVL across pools and alert on sharp changes",
});

// ─── Shared Types ────────────────────────────────────────────────────────────

const ProtocolId = z.enum([
  "aave-v3",
  "compound-v3",
  "uniswap-v3",
  "curve",
  "balancer",
  "lido",
  "rocket-pool",
  "morpho",
  "pendle",
  "eigenlayer",
]);

const PoolConfig = z.object({
  chain: z.string().describe("Chain name (e.g. ethereum, arbitrum, polygon)"),
  protocol: ProtocolId,
  address: z.string().describe("Pool contract address"),
  name: z.string().optional().describe("Human-readable pool name"),
});

const ThresholdRule = z.object({
  metric: z.enum(["apy", "tvl"]).describe("Which metric to monitor"),
  direction: z
    .enum(["rise", "drop", "both"])
    .describe("Direction of change that triggers alert"),
  percent: z
    .number()
    .min(0.1)
    .max(1000)
    .describe("Percentage change threshold"),
});

// ─── Internal Types ──────────────────────────────────────────────────────────

interface PoolMetrics {
  address: string;
  name: string;
  protocol: string;
  chain: string;
  apy: number;
  tvlUsd: number;
  timestamp: number;
}

interface MetricDelta {
  address: string;
  metric: "apy" | "tvl";
  current: number;
  previous: number;
  changePercent: number;
}

interface Alert {
  address: string;
  metric: "apy" | "tvl";
  direction: "rise" | "drop";
  threshold: number;
  changePercent: number;
  current: number;
  previous: number;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: number;
}

// ─── Mock Data Store (replace with real onchain indexing in production) ──────

let lastMetrics: Map<string, PoolMetrics> = new Map();

function poolKey(pool: { chain: string; protocol: string; address: string }) {
  return `${pool.chain}:${pool.protocol}:${pool.address}`;
}

/**
 * Fetch current metrics for a pool.
 * In production: call the protocol's subgraph, RPC, or DeFiLlama API.
 * This implementation returns simulated data for demonstration.
 */
async function fetchPoolMetrics(
  pool: z.infer<typeof PoolConfig>
): Promise<PoolMetrics> {
  const baseApy = Math.random() * 20 + 1;
  const baseTvl = Math.random() * 500_000_000 + 1_000_000;

  return {
    address: pool.address,
    name: pool.name ?? `${pool.protocol} pool`,
    protocol: pool.protocol,
    chain: pool.chain,
    apy: parseFloat(baseApy.toFixed(2)),
    tvlUsd: parseFloat(baseTvl.toFixed(2)),
    timestamp: Date.now(),
  };
}

function computeDeltas(
  current: PoolMetrics,
  previous?: PoolMetrics
): MetricDelta[] {
  if (!previous) return [];

  const apyChange =
    previous.apy > 0
      ? parseFloat((((current.apy - previous.apy) / previous.apy) * 100).toFixed(2))
      : 0;

  const tvlChange =
    previous.tvlUsd > 0
      ? parseFloat(
          (((current.tvlUsd - previous.tvlUsd) / previous.tvlUsd) * 100).toFixed(2)
        )
      : 0;

  return [
    { address: current.address, metric: "apy", current: current.apy, previous: previous.apy, changePercent: apyChange },
    { address: current.address, metric: "tvl", current: current.tvlUsd, previous: previous.tvlUsd, changePercent: tvlChange },
  ];
}

function evaluateThresholds(
  deltas: MetricDelta[],
  rules: z.infer<typeof ThresholdRule>[]
): Alert[] {
  const alerts: Alert[] = [];

  for (const delta of deltas) {
    for (const rule of rules) {
      if (delta.metric !== rule.metric) continue;

      const isRise = delta.changePercent > 0;
      const magnitude = Math.abs(delta.changePercent);

      if (magnitude < rule.percent) continue;
      if (rule.direction === "rise" && !isRise) continue;
      if (rule.direction === "drop" && isRise) continue;

      const severity =
        magnitude >= rule.percent * 3
          ? "critical"
          : magnitude >= rule.percent * 2
            ? "warning"
            : "info";

      alerts.push({
        address: delta.address,
        metric: delta.metric,
        direction: isRise ? "rise" : "drop",
        threshold: rule.percent,
        changePercent: delta.changePercent,
        current: delta.current,
        previous: delta.previous,
        severity,
        message: `${delta.metric.toUpperCase()} ${isRise ? "surged" : "dropped"} ${Math.abs(delta.changePercent)}% for pool ${delta.address} (threshold: ${rule.percent}%)`,
        timestamp: Date.now(),
      });
    }
  }

  return alerts;
}

// ─── Entrypoint: watch-pools ─────────────────────────────────────────────────

addEntrypoint({
  key: "watch-pools",
  description: "Fetch current APY and TVL for one or more yield pools",
  input: z.object({
    pools: z.array(PoolConfig).min(1).max(50).describe("Pools to monitor"),
  }),
  output: z.object({
    metrics: z.array(z.any()),
    deltas: z.array(z.any()),
  }),
  price: "500",
  async handler({ input }) {
    const results: PoolMetrics[] = [];
    const allDeltas: MetricDelta[] = [];

    for (const pool of input.pools) {
      const key = poolKey(pool);
      const current = await fetchPoolMetrics(pool);
      const previous = lastMetrics.get(key);
      const deltas = computeDeltas(current, previous);

      lastMetrics.set(key, current);
      results.push(current);
      allDeltas.push(...deltas);
    }

    return {
      output: {
        metrics: results,
        deltas: allDeltas,
      },
      usage: { total_tokens: String(input.pools.length) },
    };
  },
});

// ─── Entrypoint: check-alerts ────────────────────────────────────────────────

addEntrypoint({
  key: "check-alerts",
  description:
    "Compare current pool metrics against threshold rules and return triggered alerts",
  input: z.object({
    pools: z.array(PoolConfig).min(1).max(50),
    thresholds: z
      .array(ThresholdRule)
      .min(1)
      .max(10)
      .describe("Alert threshold configurations"),
  }),
  output: z.object({
    alerts: z.array(z.any()),
    summary: z.string(),
  }),
  price: "1000",
  async handler({ input }) {
    const allAlerts: Alert[] = [];

    for (const pool of input.pools) {
      const key = poolKey(pool);
      const current = await fetchPoolMetrics(pool);
      const previous = lastMetrics.get(key);

      if (previous) {
        const deltas = computeDeltas(current, previous);
        const alerts = evaluateThresholds(deltas, input.thresholds);
        allAlerts.push(...alerts);
      }

      lastMetrics.set(key, current);
    }

    const criticals = allAlerts.filter((a) => a.severity === "critical").length;
    const warnings = allAlerts.filter((a) => a.severity === "warning").length;

    const summary =
      allAlerts.length === 0
        ? "No thresholds breached. All monitored pools are within normal ranges."
        : `Found ${allAlerts.length} triggered alert(s): ${criticals} critical, ${warnings} warning, ${allAlerts.length - criticals - warnings} info.`;

    return {
      output: { alerts: allAlerts, summary },
      usage: { total_tokens: String(input.pools.length) },
    };
  },
});

export default app;
