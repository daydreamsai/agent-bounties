/**
 * DeFi Llama API client for fetching pool metrics.
 * Uses the free, no-auth-required API at https://yields.llama.fi
 */

export interface PoolData {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
}

export interface PoolSnapshot {
  pool: string;
  tvlUsd: number;
  apy: number;
  timestamp: string;
}

const BASE_URL = "https://yields.llama.fi";

/**
 * Fetch all pools from DeFi Llama yields API.
 */
export async function fetchAllPools(): Promise<PoolData[]> {
  const res = await fetch(`${BASE_URL}/pools`);
  if (!res.ok) throw new Error(`DeFi Llama API error: ${res.status}`);
  const json = (await res.json()) as { data: PoolData[] };
  return json.data;
}

/**
 * Filter pools by protocol/project names.
 */
export function filterByProtocols(
  pools: PoolData[],
  protocolIds: string[]
): PoolData[] {
  const normalized = protocolIds.map((p) => p.toLowerCase());
  return pools.filter((p) => normalized.includes(p.project.toLowerCase()));
}

/**
 * Filter pools by specific pool IDs.
 */
export function filterByPoolIds(
  pools: PoolData[],
  poolIds: string[]
): PoolData[] {
  const idSet = new Set(poolIds);
  return pools.filter((p) => idSet.has(p.pool));
}

/**
 * Fetch historical APY/TVL chart data for a specific pool.
 */
export async function fetchPoolChart(
  poolId: string
): Promise<PoolSnapshot[]> {
  const res = await fetch(`${BASE_URL}/chart/${poolId}`);
  if (!res.ok) throw new Error(`DeFi Llama chart API error: ${res.status}`);
  const json = (await res.json()) as { data: PoolSnapshot[] };
  return json.data;
}
