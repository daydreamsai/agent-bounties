/**
 * Yield Pool Watcher Agent
 *
 * Tracks APY and TVL across DeFi pools and alerts on sharp changes.
 * Uses DefiLlama API for real-time pool data.
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/6
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

interface PoolMetrics {
  pool_id: string;
  protocol: string;
  chain: string;
  symbol: string;
  apy: number;
  apy_base: number;
  apy_reward: number;
  tvl_usd: number;
  apy_7d_mean: number | null;
  apy_change_1d: number | null;
  tvl_change_1d: number | null;
  il_risk: string;
  alerts: string[];
}

// DeFiLlama pools API
async function fetchDefiLlamaPools(
  protocolIds: string[],
  poolFilters: string[]
): Promise<PoolMetrics[]> {
  const res = await fetch("https://yields.llama.fi/pools");
  if (!res.ok) throw new Error(`DefiLlama API error: ${res.status}`);

  const data = await res.json();
  let pools = data.data || [];

  // Filter by protocol
  if (protocolIds.length > 0) {
    const protocols = protocolIds.map((p) => p.toLowerCase());
    pools = pools.filter((p: { project?: string }) =>
      protocols.some((proto) => p.project?.toLowerCase().includes(proto))
    );
  }

  // Filter by pool symbol/address
  if (poolFilters.length > 0) {
    const filters = poolFilters.map((f) => f.toLowerCase());
    pools = pools.filter((p: { symbol?: string; pool?: string }) =>
      filters.some(
        (f) =>
          p.symbol?.toLowerCase().includes(f) ||
          p.pool?.toLowerCase() === f
      )
    );
  }

  // Sort by TVL desc and take top 50
  pools = pools
    .sort((a: { tvlUsd?: number }, b: { tvlUsd?: number }) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
    .slice(0, 50);

  return pools.map((p: {
    pool?: string;
    project?: string;
    chain?: string;
    symbol?: string;
    apy?: number;
    apyBase?: number;
    apyReward?: number;
    tvlUsd?: number;
    apyMean30d?: number;
    apyPct1D?: number;
    apyPct7D?: number;
    ilRisk?: string;
  }) => {
    const apy = p.apy || 0;
    const apy7dMean = p.apyMean30d || null;
    const apyChange1d = p.apyPct1D || null;
    const tvl = p.tvlUsd || 0;

    const alerts: string[] = [];

    // Alert on APY spike > 50% change
    if (apyChange1d !== null && Math.abs(apyChange1d) > 50) {
      alerts.push(
        `APY changed ${apyChange1d.toFixed(1)}% in 1 day — potential rug/incentive change`
      );
    }

    // Alert on very high APY (likely unsustainable)
    if (apy > 1000) {
      alerts.push(`APY >1000% (${apy.toFixed(0)}%) — extremely high risk`);
    }

    // Alert on low TVL with high APY
    if (tvl < 100000 && apy > 100) {
      alerts.push(`Low TVL ($${(tvl / 1000).toFixed(0)}K) with high APY — exit liquidity risk`);
    }

    return {
      pool_id: p.pool || "",
      protocol: p.project || "unknown",
      chain: p.chain || "unknown",
      symbol: p.symbol || "unknown",
      apy: apy,
      apy_base: p.apyBase || 0,
      apy_reward: p.apyReward || 0,
      tvl_usd: tvl,
      apy_7d_mean: apy7dMean,
      apy_change_1d: apyChange1d,
      tvl_change_1d: null, // not directly available
      il_risk: p.ilRisk || "none",
      alerts,
    };
  });
}

// ─── Agent App ────────────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "yield-pool-watcher",
  version: "1.0.0",
  description:
    "Track APY and TVL across DeFi pools and alert on sharp changes using DefiLlama data.",
});

addEntrypoint({
  key: "watch_pools",
  description:
    "Monitor pool metrics (APY, TVL) and emit alerts on spikes or drains.",
  input: z.object({
    protocol_ids: z
      .array(z.string())
      .default(["aave", "uniswap", "curve", "compound", "lido"])
      .describe("DeFi protocols to monitor (e.g. aave, uniswap, curve)"),
    pools: z
      .array(z.string())
      .default([])
      .describe("Specific pool symbols or addresses to filter"),
    threshold_rules: z
      .object({
        min_tvl_usd: z.number().default(1000000).describe("Minimum TVL filter"),
        max_apy: z.number().default(10000).describe("Flag APY above this value"),
        apy_change_alert_pct: z
          .number()
          .default(50)
          .describe("Alert if APY changes more than X% in 1 day"),
      })
      .default({}),
  }),
  async handler({ input }) {
    const pools = await fetchDefiLlamaPools(input.protocol_ids, input.pools);

    // Apply threshold filters
    const rules = input.threshold_rules;
    const filtered = pools.filter((p) => p.tvl_usd >= (rules.min_tvl_usd || 0));

    // Generate additional alerts based on thresholds
    for (const pool of filtered) {
      if (pool.apy > (rules.max_apy || 10000)) {
        pool.alerts.push(`APY (${pool.apy.toFixed(0)}%) exceeds threshold of ${rules.max_apy}%`);
      }
      if (
        pool.apy_change_1d !== null &&
        Math.abs(pool.apy_change_1d) > (rules.apy_change_alert_pct || 50)
      ) {
        pool.alerts.push(
          `APY change (${pool.apy_change_1d.toFixed(1)}%) exceeds alert threshold`
        );
      }
    }

    const alertedPools = filtered.filter((p) => p.alerts.length > 0);

    return {
      output: {
        pool_metrics: filtered,
        alerts: alertedPools.flatMap((p) =>
          p.alerts.map((a) => ({ pool: p.symbol, protocol: p.protocol, alert: a }))
        ),
        total_pools: filtered.length,
        alerted_pools: alertedPools.length,
        fetched_at: new Date().toISOString(),
      },
      usage: { total_tokens: String(filtered.length) },
    };
  },
});

addEntrypoint({
  key: "echo",
  description: "Health check",
  input: z.object({ text: z.string().optional() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "yield-pool-watcher online") },
      usage: { total_tokens: "0" },
    };
  },
});

const PORT = parseInt(process.env.PORT ?? "8084");
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Yield Pool Watcher running on http://0.0.0.0:${info.port}`);
});

export default app;
