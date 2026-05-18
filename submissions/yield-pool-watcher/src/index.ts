import { z } from "zod/v4";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp(
  {
    name: "yield-pool-watcher",
    version: "0.1.0",
    description:
      "Track APY and TVL across DeFi pools and alert on sharp changes in metrics",
  },
  {
    config: {
      payments: false,
    },
  }
);

// --- Types ---

interface PoolMetrics {
  pool: string;
  chain: string;
  project: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number | null;
  apy: number;
  il7d: number | null;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
}

interface Delta {
  pool: string;
  metric: string;
  oldValue: number;
  newValue: number;
  changePercent: number;
}

interface Alert {
  pool: string;
  metric: string;
  severity: "info" | "warning" | "critical";
  message: string;
  value: number;
  threshold: number;
}

// --- Data Sources ---

// DefiLlama yields API
const DEFILLAMA_YIELDS = "https://yields.llama.fi/pools";

// Cache for previous snapshots (in-memory; in production use KV/DB)
let previousSnapshots: Map<string, { tvlUsd: number; apy: number }> = new Map();

async function fetchAllPools(): Promise<PoolMetrics[]> {
  try {
    const res = await fetch(DEFILLAMA_YIELDS);
    if (!res.ok) throw new Error(`DefiLlama API error: ${res.status}`);
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];
    return data.data.map((p: any) => ({
      pool: p.pool || p.symbol || "unknown",
      chain: p.chain || "unknown",
      project: p.project || "unknown",
      tvlUsd: p.tvlUsd ?? 0,
      apyBase: p.apyBase ?? 0,
      apyReward: p.apyReward ?? null,
      apy: (p.apyBase ?? 0) + (p.apyReward ?? 0),
      il7d: p.il7d ?? null,
      volumeUsd1d: p.volumeUsd1d ?? null,
      volumeUsd7d: p.volumeUsd7d ?? null,
    }));
  } catch (e) {
    console.error("Error fetching DefiLlama pools:", e);
    return [];
  }
}

function filterPools(
  pools: PoolMetrics[],
  protocolIds?: string[],
  poolFilter?: string[]
): PoolMetrics[] {
  return pools.filter((p) => {
    // Filter by protocol
    if (protocolIds && protocolIds.length > 0) {
      const match = protocolIds.some(
        (pid) =>
          p.project.toLowerCase().includes(pid.toLowerCase()) ||
          pid.toLowerCase().includes(p.project.toLowerCase())
      );
      if (!match) return false;
    }
    // Filter by specific pools
    if (poolFilter && poolFilter.length > 0) {
      const match = poolFilter.some(
        (pf) =>
          p.pool.toLowerCase().includes(pf.toLowerCase()) ||
          p.chain.toLowerCase().includes(pf.toLowerCase())
      );
      if (!match) return false;
    }
    return true;
  });
}

function computeDeltas(
  current: PoolMetrics[],
  thresholdRules: { metric: string; thresholdPct: number }[]
): { deltas: Delta[]; alerts: Alert[] } {
  const deltas: Delta[] = [];
  const alerts: Alert[] = [];

  for (const pool of current) {
    const prev = previousSnapshots.get(pool.pool);
    if (!prev) continue;

    // TVL delta
    const tvlChange =
      prev.tvlUsd > 0
        ? ((pool.tvlUsd - prev.tvlUsd) / prev.tvlUsd) * 100
        : 0;
    deltas.push({
      pool: pool.pool,
      metric: "tvlUsd",
      oldValue: prev.tvlUsd,
      newValue: pool.tvlUsd,
      changePercent: tvlChange,
    });

    // APY delta
    const apyChange =
      prev.apy > 0
        ? ((pool.apy - prev.apy) / prev.apy) * 100
        : pool.apy > 0
        ? 100
        : 0;
    deltas.push({
      pool: pool.pool,
      metric: "apy",
      oldValue: prev.apy,
      newValue: pool.apy,
      changePercent: apyChange,
    });

    // Check thresholds for alerts
    for (const rule of thresholdRules) {
      let changePct = 0;
      let currentVal = 0;
      if (rule.metric === "tvlUsd") {
        changePct = tvlChange;
        currentVal = pool.tvlUsd;
      } else if (rule.metric === "apy") {
        changePct = apyChange;
        currentVal = pool.apy;
      } else if (rule.metric === "apyBase") {
        const prevBase = prev.apy ?? 0;
        const curBase = pool.apyBase;
        changePct = prevBase > 0 ? ((curBase - prevBase) / prevBase) * 100 : 0;
        currentVal = curBase;
      }

      if (Math.abs(changePct) >= rule.thresholdPct) {
        const severity: "info" | "warning" | "critical" =
          Math.abs(changePct) >= rule.thresholdPct * 3
            ? "critical"
            : Math.abs(changePct) >= rule.thresholdPct * 2
            ? "warning"
            : "info";

        const direction = changePct > 0 ? "increased" : "decreased";
        alerts.push({
          pool: pool.pool,
          metric: rule.metric,
          severity,
          message: `${pool.pool} ${rule.metric} ${direction} by ${Math.abs(changePct).toFixed(
            2
          )}% (${currentVal.toFixed(2)})`,
          value: currentVal,
          threshold: rule.thresholdPct,
        });
      }
    }
  }

  return { deltas, alerts };
}

// --- Entrypoints ---

// Main entrypoint: watch pools and return metrics + deltas + alerts
addEntrypoint({
  key: "watch",
  description:
    "Monitor DeFi yield pool metrics (APY, TVL) and return current state + alerts on sharp changes",
  input: z.object({
    protocol_ids: z
      .array(z.string())
      .optional()
      .describe("DeFi protocols to monitor (e.g. curve, aave, uniswap)"),
    pools: z
      .array(z.string())
      .optional()
      .describe("Specific pools to watch by name or chain"),
    threshold_rules: z
      .array(
        z.object({
          metric: z
            .enum(["tvlUsd", "apy", "apyBase"])
            .describe("Metric to monitor"),
          threshold_pct: z
            .number()
            .positive()
            .describe("Change percentage to trigger alert (e.g. 10 = 10%)"),
        })
      )
      .optional()
      .default([{ metric: "tvlUsd", threshold_pct: 10 }, { metric: "apy", threshold_pct: 15 }])
      .describe("Alert threshold configuration"),
  }),
  async handler({ input }) {
    const thresholdRules = (input.threshold_rules ?? [
      { metric: "tvlUsd" as const, threshold_pct: 10 },
      { metric: "apy" as const, threshold_pct: 15 },
    ]).map((r) => ({ metric: r.metric, thresholdPct: r.threshold_pct }));

    // Fetch all pools from DefiLlama
    const allPools = await fetchAllPools();

    // Filter by requested protocols/pools
    const filteredPools = filterPools(
      allPools,
      input.protocol_ids,
      input.pools
    );

    // Compute deltas and alerts
    const { deltas, alerts } = computeDeltas(filteredPools, thresholdRules);

    // Top pools by TVL (for quick reference)
    const topPools = [...filteredPools]
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 20)
      .map((p) => ({
        pool: p.pool,
        chain: p.chain,
        project: p.project,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        apyBase: p.apyBase,
        apyReward: p.apyReward,
      }));

    // Update snapshots for next run
    for (const p of filteredPools) {
      previousSnapshots.set(p.pool, { tvlUsd: p.tvlUsd, apy: p.apy });
    }

    return {
      output: {
        pool_metrics: topPools,
        deltas: deltas.slice(0, 50), // cap for response size
        alerts,
        summary: {
          total_pools_monitored: filteredPools.length,
          alerts_triggered: alerts.length,
          deltas_computed: deltas.length,
          top_pools_by_tvl: topPools.slice(0, 5).map((p) => ({
            pool: p.pool,
            tvlUsd: p.tvlUsd,
            apy: p.apy,
          })),
        },
        timestamp: new Date().toISOString(),
      },
      usage: {
        total_tokens: filteredPools.length + deltas.length + alerts.length,
      },
    };
  },
});

// Quick entrypoint: yield summary for a specific protocol
addEntrypoint({
  key: "quick",
  description: "Quick yield pool summary for a specific protocol or chain",
  input: z.object({
    protocol: z.string().describe("Protocol name (e.g., curve, aave, uniswap)"),
    chain: z.string().optional().describe("Chain filter (e.g., ethereum, arbitrum)"),
    min_tvl: z.number().optional().default(100000).describe("Minimum TVL in USD"),
    limit: z.number().optional().default(10).describe("Max pools to return"),
  }),
  async handler({ input }) {
    const allPools = await fetchAllPools();

    // Filter by protocol
    let pools = allPools.filter((p) =>
      p.project.toLowerCase().includes(input.protocol.toLowerCase())
    );

    // Filter by chain
    if (input.chain) {
      pools = pools.filter((p) =>
        p.chain.toLowerCase().includes(input.chain!.toLowerCase())
      );
    }

    // Filter by min TVL
    pools = pools.filter((p) => p.tvlUsd >= (input.min_tvl ?? 100000));

    // Sort by highest APY and take top N
    const topByApy = [...pools]
      .sort((a, b) => b.apy - a.apy)
      .slice(0, input.limit ?? 10)
      .map((p) => ({
        pool: p.pool,
        chain: p.chain,
        project: p.project,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        apyBase: p.apyBase,
        apyReward: p.apyReward,
      }));

    const avgApy =
      topByApy.length > 0
        ? topByApy.reduce((s, p) => s + p.apy, 0) / topByApy.length
        : 0;
    const totalTvl = topByApy.reduce((s, p) => s + p.tvlUsd, 0);

    return {
      output: {
        protocol: input.protocol,
        chain: input.chain ?? "all",
        pools: topByApy,
        stats: {
          total_pools_matched: pools.length,
          pools_returned: topByApy.length,
          avg_apy: avgApy,
          total_tvl_filtered: totalTvl,
        },
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: topByApy.length },
    };
  },
});

export default app;
