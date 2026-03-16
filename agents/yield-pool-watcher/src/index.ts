import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

// ── Types ─────────────────────────────────────────────────────────

interface PoolMetric {
  poolId: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  rewardTokens: string[] | null;
  poolMeta: string | null;
  timestamp: string;
}

interface PoolDelta {
  poolId: string;
  symbol: string;
  chain: string;
  project: string;
  tvlChange: number;
  tvlChangePercent: number;
  apyChange: number;
  apyChangePercent: number;
  sinceTimestamp: string;
  currentTimestamp: string;
}

interface Alert {
  id: string;
  poolId: string;
  symbol: string;
  chain: string;
  project: string;
  type: "tvl_spike" | "tvl_drain" | "apy_spike" | "apy_drop";
  severity: "critical" | "warning" | "info";
  message: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  threshold: number;
  triggeredAt: string;
}

interface WatcherResult {
  poolMetrics: PoolMetric[];
  deltas: PoolDelta[];
  alerts: Alert[];
  summary: {
    poolsWatched: number;
    alertsTriggered: number;
    criticalAlerts: number;
    checkedAt: string;
  };
}

// ── In-memory state for tracking changes ──────────────────────────

interface PoolSnapshot {
  metrics: PoolMetric;
  timestamp: string;
}

const poolHistory = new Map<string, PoolSnapshot>();
let alertCounter = 0;

// ── DeFiLlama API client ──────────────────────────────────────────

const DEFILLAMA_BASE = "https://yields.llama.fi";

interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  rewardTokens: string[] | null;
  poolMeta: string | null;
}

async function fetchAllPools(): Promise<DefiLlamaPool[]> {
  const response = await fetch(`${DEFILLAMA_BASE}/pools`);
  if (!response.ok) {
    throw new Error(`DeFiLlama API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return (data.data || []) as DefiLlamaPool[];
}

async function fetchPoolHistory(poolId: string): Promise<{ timestamp: string; tvlUsd: number; apy: number }[]> {
  const response = await fetch(`${DEFILLAMA_BASE}/chart/${poolId}`);
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return (data.data || []) as { timestamp: string; tvlUsd: number; apy: number }[];
}

// ── Threshold evaluation ──────────────────────────────────────────

interface ThresholdRule {
  metric: "tvl" | "apy";
  direction: "increase" | "decrease" | "both";
  thresholdPercent: number;
  severity?: "critical" | "warning" | "info";
}

const DEFAULT_RULES: ThresholdRule[] = [
  { metric: "tvl", direction: "decrease", thresholdPercent: 20, severity: "critical" },
  { metric: "tvl", direction: "increase", thresholdPercent: 50, severity: "warning" },
  { metric: "apy", direction: "decrease", thresholdPercent: 30, severity: "warning" },
  { metric: "apy", direction: "increase", thresholdPercent: 100, severity: "info" },
];

function evaluateThresholds(
  current: PoolMetric,
  previous: PoolSnapshot,
  rules: ThresholdRule[]
): Alert[] {
  const alerts: Alert[] = [];
  const delta = computeDelta(current, previous.metrics);

  for (const rule of rules) {
    const severity = rule.severity || "warning";

    if (rule.metric === "tvl") {
      const changePercent = delta.tvlChangePercent;
      if (rule.direction === "decrease" && changePercent < 0 && Math.abs(changePercent) >= rule.thresholdPercent) {
        alerts.push({
          id: `alert_${++alertCounter}`,
          poolId: current.poolId,
          symbol: current.symbol,
          chain: current.chain,
          project: current.project,
          type: "tvl_drain",
          severity,
          message: `TVL dropped ${Math.abs(changePercent).toFixed(1)}% (from $${formatNumber(previous.metrics.tvlUsd)} to $${formatNumber(current.tvlUsd)})`,
          currentValue: current.tvlUsd,
          previousValue: previous.metrics.tvlUsd,
          changePercent,
          threshold: rule.thresholdPercent,
          triggeredAt: new Date().toISOString(),
        });
      }
      if (rule.direction === "increase" && changePercent > 0 && changePercent >= rule.thresholdPercent) {
        alerts.push({
          id: `alert_${++alertCounter}`,
          poolId: current.poolId,
          symbol: current.symbol,
          chain: current.chain,
          project: current.project,
          type: "tvl_spike",
          severity,
          message: `TVL spiked ${changePercent.toFixed(1)}% (from $${formatNumber(previous.metrics.tvlUsd)} to $${formatNumber(current.tvlUsd)})`,
          currentValue: current.tvlUsd,
          previousValue: previous.metrics.tvlUsd,
          changePercent,
          threshold: rule.thresholdPercent,
          triggeredAt: new Date().toISOString(),
        });
      }
      if (rule.direction === "both" && Math.abs(changePercent) >= rule.thresholdPercent) {
        alerts.push({
          id: `alert_${++alertCounter}`,
          poolId: current.poolId,
          symbol: current.symbol,
          chain: current.chain,
          project: current.project,
          type: changePercent > 0 ? "tvl_spike" : "tvl_drain",
          severity,
          message: `TVL changed ${changePercent.toFixed(1)}% (from $${formatNumber(previous.metrics.tvlUsd)} to $${formatNumber(current.tvlUsd)})`,
          currentValue: current.tvlUsd,
          previousValue: previous.metrics.tvlUsd,
          changePercent,
          threshold: rule.thresholdPercent,
          triggeredAt: new Date().toISOString(),
        });
      }
    }

    if (rule.metric === "apy") {
      const changePercent = delta.apyChangePercent;
      if (rule.direction === "decrease" && changePercent < 0 && Math.abs(changePercent) >= rule.thresholdPercent) {
        alerts.push({
          id: `alert_${++alertCounter}`,
          poolId: current.poolId,
          symbol: current.symbol,
          chain: current.chain,
          project: current.project,
          type: "apy_drop",
          severity,
          message: `APY dropped ${Math.abs(changePercent).toFixed(1)}% (from ${previous.metrics.apy.toFixed(2)}% to ${current.apy.toFixed(2)}%)`,
          currentValue: current.apy,
          previousValue: previous.metrics.apy,
          changePercent,
          threshold: rule.thresholdPercent,
          triggeredAt: new Date().toISOString(),
        });
      }
      if (rule.direction === "increase" && changePercent > 0 && changePercent >= rule.thresholdPercent) {
        alerts.push({
          id: `alert_${++alertCounter}`,
          poolId: current.poolId,
          symbol: current.symbol,
          chain: current.chain,
          project: current.project,
          type: "apy_spike",
          severity,
          message: `APY spiked ${changePercent.toFixed(1)}% (from ${previous.metrics.apy.toFixed(2)}% to ${current.apy.toFixed(2)}%)`,
          currentValue: current.apy,
          previousValue: previous.metrics.apy,
          changePercent,
          threshold: rule.thresholdPercent,
          triggeredAt: new Date().toISOString(),
        });
      }
    }
  }

  return alerts;
}

function computeDelta(current: PoolMetric, previous: PoolMetric): PoolDelta {
  const tvlChange = current.tvlUsd - previous.tvlUsd;
  const tvlChangePercent = previous.tvlUsd > 0 ? (tvlChange / previous.tvlUsd) * 100 : 0;
  const apyChange = current.apy - previous.apy;
  const apyChangePercent = previous.apy > 0 ? (apyChange / previous.apy) * 100 : 0;

  return {
    poolId: current.poolId,
    symbol: current.symbol,
    chain: current.chain,
    project: current.project,
    tvlChange,
    tvlChangePercent,
    apyChange,
    apyChangePercent,
    sinceTimestamp: previous.timestamp,
    currentTimestamp: current.timestamp,
  };
}

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

// ── Main watch function ───────────────────────────────────────────

async function watchPools(
  protocolIds: string[],
  poolIds: string[],
  rules: ThresholdRule[]
): Promise<WatcherResult> {
  const allPools = await fetchAllPools();
  const now = new Date().toISOString();

  // Filter pools
  let filtered = allPools;
  if (protocolIds.length > 0) {
    filtered = filtered.filter((p) => protocolIds.includes(p.project));
  }
  if (poolIds.length > 0) {
    filtered = filtered.filter((p) => poolIds.includes(p.pool));
  }

  // Sort by TVL descending and limit
  filtered.sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0));
  const topPools = filtered.slice(0, 50);

  const poolMetrics: PoolMetric[] = [];
  const deltas: PoolDelta[] = [];
  const alerts: Alert[] = [];

  for (const pool of topPools) {
    const metric: PoolMetric = {
      poolId: pool.pool,
      chain: pool.chain,
      project: pool.project,
      symbol: pool.symbol,
      tvlUsd: pool.tvlUsd || 0,
      apy: pool.apy || 0,
      apyBase: pool.apyBase,
      apyReward: pool.apyReward,
      rewardTokens: pool.rewardTokens,
      poolMeta: pool.poolMeta,
      timestamp: now,
    };

    poolMetrics.push(metric);

    // Check against previous snapshot
    const prev = poolHistory.get(pool.pool);
    if (prev) {
      const delta = computeDelta(metric, prev.metrics);
      deltas.push(delta);

      // Evaluate thresholds
      const poolAlerts = evaluateThresholds(metric, prev, rules);
      alerts.push(...poolAlerts);
    }

    // Update history
    poolHistory.set(pool.pool, { metrics: metric, timestamp: now });
  }

  return {
    poolMetrics,
    deltas,
    alerts,
    summary: {
      poolsWatched: poolMetrics.length,
      alertsTriggered: alerts.length,
      criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
      checkedAt: now,
    },
  };
}

// ── Zod schemas ───────────────────────────────────────────────────

const ThresholdRuleSchema = z.object({
  metric: z.enum(["tvl", "apy"]),
  direction: z.enum(["increase", "decrease", "both"]),
  thresholdPercent: z.number(),
  severity: z.enum(["critical", "warning", "info"]).optional(),
});

const InputSchema = z.object({
  protocol_ids: z
    .array(z.string())
    .optional()
    .default([])
    .describe("DeFi protocols to monitor (e.g., 'aave-v3', 'lido', 'uniswap-v3')"),
  pools: z
    .array(z.string())
    .optional()
    .default([])
    .describe("Specific pool IDs to watch"),
  threshold_rules: z
    .array(ThresholdRuleSchema)
    .optional()
    .describe("Custom alert threshold rules (uses defaults if omitted)"),
});

const AlertSchema = z.object({
  id: z.string(),
  poolId: z.string(),
  symbol: z.string(),
  chain: z.string(),
  project: z.string(),
  type: z.enum(["tvl_spike", "tvl_drain", "apy_spike", "apy_drop"]),
  severity: z.enum(["critical", "warning", "info"]),
  message: z.string(),
  currentValue: z.number(),
  previousValue: z.number(),
  changePercent: z.number(),
  threshold: z.number(),
  triggeredAt: z.string(),
});

const PoolMetricSchema = z.object({
  poolId: z.string(),
  chain: z.string(),
  project: z.string(),
  symbol: z.string(),
  tvlUsd: z.number(),
  apy: z.number(),
  apyBase: z.number().nullable(),
  apyReward: z.number().nullable(),
  rewardTokens: z.array(z.string()).nullable(),
  poolMeta: z.string().nullable(),
  timestamp: z.string(),
});

const OutputSchema = z.object({
  poolMetrics: z.array(PoolMetricSchema),
  deltas: z.array(
    z.object({
      poolId: z.string(),
      symbol: z.string(),
      chain: z.string(),
      project: z.string(),
      tvlChange: z.number(),
      tvlChangePercent: z.number(),
      apyChange: z.number(),
      apyChangePercent: z.number(),
      sinceTimestamp: z.string(),
      currentTimestamp: z.string(),
    })
  ),
  alerts: z.array(AlertSchema),
  summary: z.object({
    poolsWatched: z.number(),
    alertsTriggered: z.number(),
    criticalAlerts: z.number(),
    checkedAt: z.string(),
  }),
});

// ── Agent app ─────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "yield-pool-watcher",
  version: "0.1.0",
  description: "Track APY and TVL across pools and alert on sharp changes",
});

addEntrypoint({
  key: "watch",
  description:
    "Monitor yield pool metrics across DeFi protocols and trigger alerts on significant changes. First call establishes baseline; subsequent calls detect deltas.",
  input: InputSchema,
  output: OutputSchema,
  async handler({ input }) {
    const protocolIds = input.protocol_ids ?? [];
    const poolIds = input.pools ?? [];
    const rules = (input.threshold_rules as ThresholdRule[]) ?? DEFAULT_RULES;

    const result = await watchPools(protocolIds, poolIds, rules);

    return {
      output: result,
      usage: {
        total_tokens: `Watched ${result.summary.poolsWatched} pools, ${result.summary.alertsTriggered} alerts`.length,
      },
    };
  },
});

addEntrypoint({
  key: "protocols",
  description: "List all supported DeFi protocols available for monitoring",
  input: z.object({}),
  async handler() {
    const allPools = await fetchAllPools();
    const protocols = [...new Set(allPools.map((p) => p.project))].sort();
    const chains = [...new Set(allPools.map((p) => p.chain))].sort();

    return {
      output: {
        protocols: protocols.slice(0, 100),
        totalProtocols: protocols.length,
        chains,
        totalPools: allPools.length,
      },
      usage: { total_tokens: protocols.length * 10 },
    };
  },
});

addEntrypoint({
  key: "pool-detail",
  description: "Get detailed metrics and historical data for a specific pool",
  input: z.object({
    pool_id: z.string().describe("Pool ID from DeFiLlama"),
  }),
  async handler({ input }) {
    const allPools = await fetchAllPools();
    const pool = allPools.find((p) => p.pool === input.pool_id);

    if (!pool) {
      throw new Error(`Pool not found: ${input.pool_id}`);
    }

    const history = await fetchPoolHistory(input.pool_id);

    return {
      output: {
        pool: {
          poolId: pool.pool,
          chain: pool.chain,
          project: pool.project,
          symbol: pool.symbol,
          tvlUsd: pool.tvlUsd || 0,
          apy: pool.apy || 0,
          apyBase: pool.apyBase,
          apyReward: pool.apyReward,
          rewardTokens: pool.rewardTokens,
          poolMeta: pool.poolMeta,
        },
        history: history.slice(-30), // Last 30 data points
        historyLength: history.length,
      },
      usage: { total_tokens: history.length * 5 },
    };
  },
});

addEntrypoint({
  key: "health-check",
  description: "Quick health check endpoint",
  input: z.object({}),
  async handler() {
    try {
      const response = await fetch(`${DEFILLAMA_BASE}/pools`, { method: "HEAD" });
      return {
        output: { ok: response.ok, defillama: response.status, version: "0.1.0" },
        usage: { total_tokens: 0 },
      };
    } catch (e) {
      return {
        output: { ok: false, error: String(e), version: "0.1.0" },
        usage: { total_tokens: 0 },
      };
    }
  },
});

export default app;
