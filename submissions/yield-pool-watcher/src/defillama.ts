import type { PoolMetric } from './types.js';

const DEFILLAMA_POOLS_URL = 'https://yields.llama.fi/pools';
const DEFILLAMA_CHART_URL = 'https://yields.llama.fi/chart';

interface LlamaPoolRow {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  tvlUsd?: number;
  apy?: number;
  apyBase?: number;
  apyReward?: number;
  ilRisk?: string;
  exposure?: string;
  predictions?: { predictedClass?: string; predictedProbability?: number };
  underlyingTokens?: string[];
  rewardTokens?: string[];
}

interface LlamaChartRow {
  timestamp?: string;
  tvlUsd?: number;
  apy?: number;
}

async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const response = await Promise.race([
      fetch(url, { headers: { accept: 'application/json' } }),
      new Promise<Response>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${url} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchAllPools(): Promise<PoolMetric[]> {
  const payload = await fetchJson<{ data?: LlamaPoolRow[] }>(DEFILLAMA_POOLS_URL, 15000);
  const rows = payload.data ?? [];
  const fetchedAt = new Date().toISOString();
  return rows.map((row) => ({
    pool: row.pool,
    project: row.project,
    chain: row.chain,
    symbol: row.symbol,
    tvl_usd: Number(row.tvlUsd ?? 0),
    apy: typeof row.apy === 'number' ? row.apy : null,
    apy_base: typeof row.apyBase === 'number' ? row.apyBase : null,
    apy_reward: typeof row.apyReward === 'number' ? row.apyReward : null,
    il_risk: row.ilRisk ?? null,
    exposure: row.exposure ?? null,
    predictions: {
      predicted_class: row.predictions?.predictedClass,
      predicted_probability: row.predictions?.predictedProbability
    },
    underlying_tokens: row.underlyingTokens ?? [],
    reward_tokens: row.rewardTokens ?? [],
    updated_at: fetchedAt
  })).filter((row) => row.pool && row.project && row.chain);
}

export async function fetchPoolChart(poolId: string): Promise<LlamaChartRow[]> {
  const payload = await fetchJson<{ data?: LlamaChartRow[] }>(`${DEFILLAMA_CHART_URL}/${encodeURIComponent(poolId)}`, 10000);
  return payload.data ?? [];
}