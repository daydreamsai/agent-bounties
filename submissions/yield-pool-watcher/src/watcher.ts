import { defaultRules, absDelta, evaluateAlerts, percentDelta } from './alerts.js';
import { fetchAllPools, fetchPoolChart } from './defillama.js';
import { watchInputSchema, type PoolDelta, type PoolMetric, type WatchOutput } from './types.js';

const previousSnapshots = new Map<string, PoolMetric>();

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function selectPools(all: PoolMetric[], protocolIds: string[], poolIds: string[], limit: number): PoolMetric[] {
  const protocolSet = new Set(protocolIds.map(normalize));
  const poolSet = new Set(poolIds.map(normalize));
  let selected = all;
  if (poolSet.size > 0) selected = selected.filter((pool) => poolSet.has(normalize(pool.pool)));
  if (protocolSet.size > 0) selected = selected.filter((pool) => protocolSet.has(normalize(pool.project)) || protocolSet.has(normalize(pool.project.replaceAll('-', ' '))));
  return selected.sort((a, b) => b.tvl_usd - a.tvl_usd).slice(0, limit);
}

function secondsBetween(later: string | null | undefined, earlier: string | null | undefined): number | null {
  if (!later || !earlier) return null;
  const laterMs = Date.parse(later);
  const earlierMs = Date.parse(earlier);
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) return null;
  return Math.max(0, Math.round((laterMs - earlierMs) / 1000));
}

async function chartDelta(pool: PoolMetric): Promise<PoolDelta | null> {
  try {
    const chart = await fetchPoolChart(pool.pool);
    const current = chart.at(-1);
    const previous = chart.length >= 2 ? chart.at(-2) : undefined;
    if (!current || !previous) return null;
    const previousTvl = typeof previous.tvlUsd === 'number' ? previous.tvlUsd : null;
    const previousApy = typeof previous.apy === 'number' ? previous.apy : null;
    return {
      pool: pool.pool,
      tvl_delta_pct: percentDelta(pool.tvl_usd, previousTvl),
      tvl_delta_usd: absDelta(pool.tvl_usd, previousTvl),
      apy_delta_pct: percentDelta(pool.apy, previousApy),
      apy_delta_abs: absDelta(pool.apy, previousApy),
      previous_tvl_usd: previousTvl,
      previous_apy: previousApy,
      previous_observed_at: previous.timestamp ?? null,
      current_observed_at: current.timestamp ?? null,
      sample_interval_seconds: secondsBetween(current.timestamp, previous.timestamp),
      source: 'defillama_chart'
    };
  } catch {
    return null;
  }
}

function memoryDelta(pool: PoolMetric): PoolDelta {
  const previous = previousSnapshots.get(pool.pool);
  previousSnapshots.set(pool.pool, pool);
  if (!previous) {
    return { pool: pool.pool, tvl_delta_pct: null, tvl_delta_usd: null, apy_delta_pct: null, apy_delta_abs: null, previous_tvl_usd: null, previous_apy: null, previous_observed_at: null, current_observed_at: pool.updated_at, sample_interval_seconds: null, source: 'none' };
  }
  return {
    pool: pool.pool,
    tvl_delta_pct: percentDelta(pool.tvl_usd, previous.tvl_usd),
    tvl_delta_usd: absDelta(pool.tvl_usd, previous.tvl_usd),
    apy_delta_pct: percentDelta(pool.apy, previous.apy),
    apy_delta_abs: absDelta(pool.apy, previous.apy),
    previous_tvl_usd: previous.tvl_usd,
    previous_apy: previous.apy,
    previous_observed_at: previous.updated_at,
    current_observed_at: pool.updated_at,
    sample_interval_seconds: secondsBetween(pool.updated_at, previous.updated_at),
    source: 'service_memory'
  };
}

export async function runYieldPoolWatcher(rawInput: unknown): Promise<WatchOutput> {
  const requestedAt = new Date().toISOString();
  const input = watchInputSchema.parse(rawInput);
  const rules = { ...defaultRules, ...(input.threshold_rules ?? {}) };
  const warnings: string[] = [];
  const poolsStart = Date.now();
  const allPools = await fetchAllPools();
  const poolsEndpointLatencyMs = Date.now() - poolsStart;
  const poolMetrics = selectPools(allPools, input.protocol_ids, input.pools, input.limit);

  if (poolMetrics.length === 0) warnings.push('No pools matched the requested protocol_ids or pools filters.');

  const deltas: PoolDelta[] = [];
  for (const pool of poolMetrics) {
    const delta = input.include_charts ? await chartDelta(pool) : null;
    deltas.push(delta ?? memoryDelta(pool));
  }

  const alerts = evaluateAlerts(poolMetrics, deltas, rules);
  const fetchedAt = new Date().toISOString();
  const chartObservedTimes = deltas.map((delta) => delta.current_observed_at).filter((value): value is string => Boolean(value));
  const chartLatestAt = chartObservedTimes.length > 0 ? chartObservedTimes.sort().at(-1) ?? null : null;
  return {
    pool_metrics: poolMetrics,
    deltas,
    alerts,
    warnings,
    freshness: {
      requested_at: requestedAt,
      fetched_at: fetchedAt,
      pools_endpoint_latency_ms: poolsEndpointLatencyMs,
      chart_points_checked: deltas.filter((delta) => delta.source === 'defillama_chart').length,
      chart_latest_at: chartLatestAt,
      chart_lag_seconds: secondsBetween(fetchedAt, chartLatestAt),
      block_level_precision: false,
      note: 'DefiLlama yield data is not block-level. Deltas report chart timestamps or service-memory sample times so callers can evaluate source lag explicitly.'
    },
    data_sources: ['defillama:yields_pools', 'defillama:yields_chart', 'service_memory_snapshot_fallback'],
    fetched_at: fetchedAt
  };
}
