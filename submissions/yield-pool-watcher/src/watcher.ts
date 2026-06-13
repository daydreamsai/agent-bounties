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
    return { pool: pool.pool, tvl_delta_pct: null, tvl_delta_usd: null, apy_delta_pct: null, apy_delta_abs: null, previous_tvl_usd: null, previous_apy: null, source: 'none' };
  }
  return {
    pool: pool.pool,
    tvl_delta_pct: percentDelta(pool.tvl_usd, previous.tvl_usd),
    tvl_delta_usd: absDelta(pool.tvl_usd, previous.tvl_usd),
    apy_delta_pct: percentDelta(pool.apy, previous.apy),
    apy_delta_abs: absDelta(pool.apy, previous.apy),
    previous_tvl_usd: previous.tvl_usd,
    previous_apy: previous.apy,
    source: 'service_memory'
  };
}

export async function runYieldPoolWatcher(rawInput: unknown): Promise<WatchOutput> {
  const input = watchInputSchema.parse(rawInput);
  const rules = { ...defaultRules, ...(input.threshold_rules ?? {}) };
  const warnings: string[] = [];
  const allPools = await fetchAllPools();
  const poolMetrics = selectPools(allPools, input.protocol_ids, input.pools, input.limit);

  if (poolMetrics.length === 0) warnings.push('No pools matched the requested protocol_ids or pools filters.');

  const deltas: PoolDelta[] = [];
  for (const pool of poolMetrics) {
    const delta = input.include_charts ? await chartDelta(pool) : null;
    deltas.push(delta ?? memoryDelta(pool));
  }

  const alerts = evaluateAlerts(poolMetrics, deltas, rules);
  return {
    pool_metrics: poolMetrics,
    deltas,
    alerts,
    warnings,
    data_sources: ['defillama:yields_pools', 'defillama:yields_chart', 'service_memory_snapshot_fallback'],
    fetched_at: new Date().toISOString()
  };
}