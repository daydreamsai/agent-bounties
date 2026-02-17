/**
 * Alert engine — detects sharp changes in APY and TVL based on configurable thresholds.
 */

import type { PoolData } from "./defillama.js";

export interface ThresholdRules {
  /** APY change percentage that triggers an alert (e.g., 20 means ±20%) */
  apyChangePercent: number;
  /** TVL change percentage that triggers an alert (e.g., 15 means ±15%) */
  tvlChangePercent: number;
  /** Minimum TVL in USD to consider (filters dust pools) */
  minTvlUsd: number;
}

export interface Alert {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  type: "apy_spike" | "apy_drop" | "tvl_spike" | "tvl_drain";
  severity: "info" | "warning" | "critical";
  message: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  timestamp: string;
}

export interface PoolDelta {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  currentApy: number;
  currentTvl: number;
  apyChange1d: number | null;
  apyChange7d: number | null;
  apyChange30d: number | null;
  tvlUsd: number;
}

export const DEFAULT_THRESHOLDS: ThresholdRules = {
  apyChangePercent: 20,
  tvlChangePercent: 15,
  minTvlUsd: 100_000,
};

/**
 * Compute deltas from pool data (uses DeFi Llama's built-in change fields).
 */
export function computeDeltas(pools: PoolData[]): PoolDelta[] {
  return pools.map((p) => ({
    pool: p.pool,
    project: p.project,
    chain: p.chain,
    symbol: p.symbol,
    currentApy: p.apy,
    currentTvl: p.tvlUsd,
    apyChange1d: p.apyPct1D,
    apyChange7d: p.apyPct7D,
    apyChange30d: p.apyPct30D,
    tvlUsd: p.tvlUsd,
  }));
}

function classifySeverity(changePercent: number): Alert["severity"] {
  const abs = Math.abs(changePercent);
  if (abs >= 50) return "critical";
  if (abs >= 25) return "warning";
  return "info";
}

/**
 * Check pools against threshold rules and generate alerts.
 */
export function checkThresholds(
  pools: PoolData[],
  previousSnapshots: Map<string, { apy: number; tvlUsd: number }>,
  rules: ThresholdRules = DEFAULT_THRESHOLDS
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  for (const pool of pools) {
    if (pool.tvlUsd < rules.minTvlUsd) continue;

    const prev = previousSnapshots.get(pool.pool);
    if (!prev) continue;

    // Check APY changes
    if (prev.apy > 0) {
      const apyChange = ((pool.apy - prev.apy) / prev.apy) * 100;
      if (Math.abs(apyChange) >= rules.apyChangePercent) {
        const type = apyChange > 0 ? "apy_spike" : "apy_drop";
        alerts.push({
          pool: pool.pool,
          project: pool.project,
          chain: pool.chain,
          symbol: pool.symbol,
          type,
          severity: classifySeverity(apyChange),
          message: `${pool.symbol} on ${pool.project} (${pool.chain}): APY ${type === "apy_spike" ? "spiked" : "dropped"} ${apyChange.toFixed(1)}% (${prev.apy.toFixed(2)}% → ${pool.apy.toFixed(2)}%)`,
          currentValue: pool.apy,
          previousValue: prev.apy,
          changePercent: apyChange,
          timestamp: now,
        });
      }
    }

    // Check TVL changes
    if (prev.tvlUsd > 0) {
      const tvlChange = ((pool.tvlUsd - prev.tvlUsd) / prev.tvlUsd) * 100;
      if (Math.abs(tvlChange) >= rules.tvlChangePercent) {
        const type = tvlChange > 0 ? "tvl_spike" : "tvl_drain";
        alerts.push({
          pool: pool.pool,
          project: pool.project,
          chain: pool.chain,
          symbol: pool.symbol,
          type,
          severity: classifySeverity(tvlChange),
          message: `${pool.symbol} on ${pool.project} (${pool.chain}): TVL ${type === "tvl_spike" ? "spiked" : "drained"} ${tvlChange.toFixed(1)}% ($${formatUsd(prev.tvlUsd)} → $${formatUsd(pool.tvlUsd)})`,
          currentValue: pool.tvlUsd,
          previousValue: prev.tvlUsd,
          changePercent: tvlChange,
          timestamp: now,
        });
      }
    }
  }

  return alerts.sort(
    (a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)
  );
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}
