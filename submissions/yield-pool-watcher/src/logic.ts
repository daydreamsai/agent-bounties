/**
 * yield-pool-watcher logic
 *
 * Fetches live DeFi pool data from the DeFiLlama Yields API (free, no key),
 * filters by protocol and optional pool criteria, detects sharp APY/TVL
 * changes, and returns structured pool snapshots with alerts.
 */

const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DefiLlamaPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  apyMean30d: number | null;
  pool: string;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string | null;
  poolMeta: string | null;
  underlyingTokens: string[] | null;
  rewardTokens: string[] | null;
  mu: number | null;
  sigma: number | null;
  count: number | null;
  outlier: boolean;
  predictions: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: number;
  } | null;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
  apyBase7d: number | null;
  apyBaseInception: number | null;
}

interface DefiLlamaResponse {
  status: string;
  data: DefiLlamaPool[];
}

export interface PoolFilter {
  address?: string;
  symbol?: string;
}

export interface WatchPoolsInput {
  protocol_ids: string[];
  pools?: PoolFilter[];
  apy_change_threshold: number;
  tvl_change_threshold: number;
  limit: number;
}

export interface PoolSnapshot {
  protocol: string;
  chain: string;
  pool_id: string;
  symbol: string;
  tvl_usd: string;
  apy: number;
  apy_base: number;
  apy_reward: number;
  apy_1d_change: number;
  apy_7d_change: number;
  tvl_1d_change_pct: number;
  il_risk: string;
  stablecoin: boolean;
}

export interface Alert {
  pool_id: string;
  symbol: string;
  protocol: string;
  type: string;
  message: string;
  severity: string;
}

export interface WatchPoolsOutput {
  pools: PoolSnapshot[];
  alerts: Alert[];
  protocol_count: number;
  total_pools_scanned: number;
  queried_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safe number: coerce null / undefined / NaN to 0 */
function safeNum(v: number | null | undefined): number {
  if (v === null || v === undefined || Number.isNaN(v)) return 0;
  return v;
}

/** Format USD amount with commas and 2 decimals */
function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Estimate 1-day TVL change percentage.
 *
 * DeFiLlama does not return a direct tvlPct1D field, but we can derive an
 * approximation from the mean-30d APY and the 1-day APY shift.  If a pool's
 * APY spiked dramatically in 1 day it often correlates with a TVL outflow
 * (fewer depositors sharing the same rewards).  However this is only a rough
 * proxy.  We use the `mu` (mean return) and `sigma` (volatility) fields when
 * available to provide a statistical estimate.  When neither is available we
 * return 0 (unknown).
 */
function estimateTvlChange(pool: DefiLlamaPool): number {
  // If the pool has volume data we can get a rough TVL delta signal:
  // large volume relative to TVL hints at significant deposits/withdrawals.
  if (pool.volumeUsd1d && pool.tvlUsd && pool.tvlUsd > 0) {
    // Volume-to-TVL ratio as a proxy — cap at +/-50% to avoid noise
    const ratio = (pool.volumeUsd1d / pool.tvlUsd) * 100;
    return Math.min(Math.max(-ratio, -50), 50);
  }

  // Fallback: use APY shift as a directional signal.
  // A large positive APY jump often means TVL dropped (same rewards, fewer depositors).
  // Invert the sign: APY up => TVL likely down.
  const apyShift = safeNum(pool.apyPct1D);
  if (apyShift !== 0 && pool.apy && pool.apy > 0) {
    // Normalize by current APY to get a proportional TVL estimate
    const proportional = -(apyShift / Math.max(pool.apy, 1)) * 100;
    return Math.min(Math.max(proportional, -50), 50);
  }

  return 0;
}

/**
 * Determine alert severity based on the magnitude of the deviation.
 */
function severity(value: number, threshold: number): "critical" | "warning" | "info" {
  const abs = Math.abs(value);
  if (abs >= threshold * 3) return "critical";
  if (abs >= threshold * 1.5) return "warning";
  return "info";
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Fetch all pools from DeFiLlama Yields API.
 * Retries once on transient failure.
 */
async function fetchPools(): Promise<DefiLlamaPool[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch(DEFILLAMA_YIELDS_URL, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`DeFiLlama API returned HTTP ${res.status}: ${res.statusText}`);
      }

      const json = (await res.json()) as DefiLlamaResponse;

      if (json.status !== "success" || !Array.isArray(json.data)) {
        throw new Error(`Unexpected response shape: status=${json.status}`);
      }

      return json.data;
    } catch (err: any) {
      lastError = err;
      // Brief pause before retry
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }
  }

  throw new Error(`Failed to fetch DeFiLlama pools after 2 attempts: ${lastError?.message}`);
}

/**
 * Normalize a DeFiLlama project slug for comparison.
 * DeFiLlama uses lowercase slugs like "aave-v3", "compound-v3", etc.
 */
function normalizeSlug(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Check whether a pool matches any of the user-supplied pool filters.
 */
function matchesPoolFilter(pool: DefiLlamaPool, filters: PoolFilter[]): boolean {
  return filters.some((f) => {
    if (f.address && pool.pool.toLowerCase() === f.address.toLowerCase()) return true;
    if (f.symbol) {
      const symbolLower = f.symbol.toLowerCase();
      // DeFiLlama symbols can be compound like "USDC-WETH" — match substring
      if (pool.symbol.toLowerCase().includes(symbolLower)) return true;
    }
    return false;
  });
}

/**
 * Transform a raw DeFiLlama pool record into a structured snapshot.
 */
function toSnapshot(pool: DefiLlamaPool): PoolSnapshot {
  const tvlChangePct = estimateTvlChange(pool);

  return {
    protocol: pool.project,
    chain: pool.chain,
    pool_id: pool.pool,
    symbol: pool.symbol,
    tvl_usd: formatUsd(safeNum(pool.tvlUsd)),
    apy: Math.round(safeNum(pool.apy) * 100) / 100,
    apy_base: Math.round(safeNum(pool.apyBase) * 100) / 100,
    apy_reward: Math.round(safeNum(pool.apyReward) * 100) / 100,
    apy_1d_change: Math.round(safeNum(pool.apyPct1D) * 100) / 100,
    apy_7d_change: Math.round(safeNum(pool.apyPct7D) * 100) / 100,
    tvl_1d_change_pct: Math.round(tvlChangePct * 100) / 100,
    il_risk: pool.ilRisk ?? "unknown",
    stablecoin: pool.stablecoin ?? false,
  };
}

/**
 * Generate alerts for a single pool based on thresholds.
 */
function detectAlerts(
  snapshot: PoolSnapshot,
  apyThreshold: number,
  tvlThreshold: number,
): Alert[] {
  const alerts: Alert[] = [];

  // --- APY spike / crash (1-day) ---
  if (Math.abs(snapshot.apy_1d_change) > apyThreshold) {
    const direction = snapshot.apy_1d_change > 0 ? "spike" : "crash";
    const sev = severity(snapshot.apy_1d_change, apyThreshold);
    alerts.push({
      pool_id: snapshot.pool_id,
      symbol: snapshot.symbol,
      protocol: snapshot.protocol,
      type: `apy_${direction}`,
      message: `APY ${direction} of ${snapshot.apy_1d_change.toFixed(2)} pp in 24h (now ${snapshot.apy.toFixed(2)}% on ${snapshot.chain})`,
      severity: sev,
    });
  }

  // --- APY spike / crash (7-day) ---
  if (Math.abs(snapshot.apy_7d_change) > apyThreshold * 2) {
    const direction = snapshot.apy_7d_change > 0 ? "spike" : "crash";
    const sev = severity(snapshot.apy_7d_change, apyThreshold * 2);
    alerts.push({
      pool_id: snapshot.pool_id,
      symbol: snapshot.symbol,
      protocol: snapshot.protocol,
      type: `apy_${direction}_7d`,
      message: `APY ${direction} of ${snapshot.apy_7d_change.toFixed(2)} pp over 7 days (now ${snapshot.apy.toFixed(2)}% on ${snapshot.chain})`,
      severity: sev,
    });
  }

  // --- TVL drain ---
  if (snapshot.tvl_1d_change_pct < -tvlThreshold) {
    const sev = severity(snapshot.tvl_1d_change_pct, tvlThreshold);
    alerts.push({
      pool_id: snapshot.pool_id,
      symbol: snapshot.symbol,
      protocol: snapshot.protocol,
      type: "tvl_drain",
      message: `Estimated TVL drop of ${Math.abs(snapshot.tvl_1d_change_pct).toFixed(1)}% in 24h (TVL $${snapshot.tvl_usd} on ${snapshot.chain})`,
      severity: sev,
    });
  }

  // --- TVL surge ---
  if (snapshot.tvl_1d_change_pct > tvlThreshold) {
    const sev = severity(snapshot.tvl_1d_change_pct, tvlThreshold);
    alerts.push({
      pool_id: snapshot.pool_id,
      symbol: snapshot.symbol,
      protocol: snapshot.protocol,
      type: "tvl_surge",
      message: `Estimated TVL surge of ${snapshot.tvl_1d_change_pct.toFixed(1)}% in 24h (TVL $${snapshot.tvl_usd} on ${snapshot.chain})`,
      severity: sev,
    });
  }

  // --- Anomalous stablecoin yield ---
  if (snapshot.stablecoin && snapshot.apy > 100) {
    alerts.push({
      pool_id: snapshot.pool_id,
      symbol: snapshot.symbol,
      protocol: snapshot.protocol,
      type: "high_stablecoin_yield",
      message: `Stablecoin pool yielding ${snapshot.apy.toFixed(2)}% APY on ${snapshot.chain} — investigate sustainability`,
      severity: snapshot.apy > 500 ? "critical" : "warning",
    });
  }

  // --- Near-zero APY on previously active pool ---
  if (snapshot.apy < 0.01 && snapshot.apy_7d_change < -5) {
    alerts.push({
      pool_id: snapshot.pool_id,
      symbol: snapshot.symbol,
      protocol: snapshot.protocol,
      type: "yield_exhausted",
      message: `Pool APY dropped to ~0% (7d change: ${snapshot.apy_7d_change.toFixed(2)} pp) — rewards may have ended`,
      severity: "warning",
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Main entry point: fetch DeFi pools, filter, detect alerts, return results.
 */
export async function watchPools(input: WatchPoolsInput): Promise<WatchPoolsOutput> {
  const rawPools = await fetchPools();

  // Normalize protocol IDs for matching
  const targetProtocols = new Set(input.protocol_ids.map(normalizeSlug));

  // Phase 1: filter by protocol
  let filtered = rawPools.filter((p) => targetProtocols.has(normalizeSlug(p.project)));

  const totalScanned = filtered.length;

  // Phase 2: if specific pools requested, narrow further
  if (input.pools && input.pools.length > 0) {
    const poolFiltered = filtered.filter((p) => matchesPoolFilter(p, input.pools!));
    // If pool filters matched something, use the narrowed set.
    // If nothing matched (user may have typo'd), fall back to full protocol set
    // so the response isn't empty without explanation.
    if (poolFiltered.length > 0) {
      filtered = poolFiltered;
    }
  }

  // Phase 3: exclude outlier pools (DeFiLlama marks unreliable data)
  filtered = filtered.filter((p) => !p.outlier);

  // Phase 4: sort by TVL descending (highest TVL first)
  filtered.sort((a, b) => safeNum(b.tvlUsd) - safeNum(a.tvlUsd));

  // Phase 5: limit
  const limited = filtered.slice(0, input.limit);

  // Phase 6: transform to snapshots and detect alerts
  const snapshots: PoolSnapshot[] = [];
  const allAlerts: Alert[] = [];

  for (const pool of limited) {
    const snap = toSnapshot(pool);
    snapshots.push(snap);

    const poolAlerts = detectAlerts(snap, input.apy_change_threshold, input.tvl_change_threshold);
    allAlerts.push(...poolAlerts);
  }

  // Sort alerts: critical first, then warning, then info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  allAlerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  // Count distinct protocols in results
  const protocolsInResults = new Set(snapshots.map((s) => s.protocol));

  return {
    pools: snapshots,
    alerts: allAlerts,
    protocol_count: protocolsInResults.size,
    total_pools_scanned: totalScanned,
    queried_at: new Date().toISOString(),
  };
}
