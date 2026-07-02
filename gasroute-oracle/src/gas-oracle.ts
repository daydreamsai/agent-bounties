/**
 * Gas price fetching & fee estimation logic for GasRoute Oracle.
 *
 * Fetches real-time gas data from public EVM RPCs + CoinGecko,
 * computes total fees, and recommends the cheapest chain.
 */

import { CHAINS, type ChainConfig } from "./chains";

// ── Types ────────────────────────────────────────────────────────

export interface GasData {
  chain: string;
  baseFeeGwei: number;
  priorityFeeGwei: number;
  /** Gas price in wei (baseFee + priorityFee) */
  gasPriceWei: bigint;
  /** Native token price in USD */
  nativeUsd: number;
  /** Estimated total fee in native token (wei → decimal) */
  feeNative: string;
  /** Estimated total fee in USD */
  feeUsd: string;
  /** Qualitative busy level */
  busyLevel: "low" | "medium" | "high" | "congested";
  /** Suggested priority fee (gwei) as a tip hint */
  tipHint: string;
}

export interface GasEstimateResult {
  chain: string;
  fee_native: string;
  fee_usd: string;
  busy_level: string;
  tip_hint: string;
}

// ── RPC helpers ──────────────────────────────────────────────────

/**
 * Make a JSON-RPC call to an EVM chain.
 */
async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[] = []
): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`RPC ${method} failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) {
    throw new Error(`RPC ${method} error: ${json.error.message}`);
  }
  return json.result;
}

// ── Gas fetching for EVM chains ──────────────────────────────────

interface EvmGasInfo {
  baseFeeGwei: number;
  priorityFeeGwei: number;
}

/**
 * Fetch gas data from an EVM chain via eth_gasPrice + eth_feeHistory.
 */
async function fetchEvmGas(chain: ChainConfig): Promise<EvmGasInfo> {
  const [gasPriceHex, feeHistoryRaw] = await Promise.all([
    rpcCall(chain.rpcUrl, "eth_gasPrice") as Promise<string>,
    rpcCall(chain.rpcUrl, "eth_feeHistory", [
      "0x1",
      "latest",
      [50],
    ]) as Promise<{
      baseFeePerGas: string[];
      reward?: string[][];
    }>,
  ]);

  const gasPriceWei = BigInt(gasPriceHex);
  const baseFeeWei = BigInt(feeHistoryRaw.baseFeePerGas[0]);
  const baseFeeGwei = Number(baseFeeWei) / 1e9;

  // priority fee = gasPrice - baseFee, with fallback
  let priorityFeeGwei: number;
  if (
    feeHistoryRaw.reward &&
    feeHistoryRaw.reward.length > 0 &&
    feeHistoryRaw.reward[0].length > 0
  ) {
    priorityFeeGwei = Number(BigInt(feeHistoryRaw.reward[0][0])) / 1e9;
  } else {
    priorityFeeGwei = Number(gasPriceWei - baseFeeWei) / 1e9;
  }

  // Guard against negative priority fee
  if (priorityFeeGwei < 0) {
    priorityFeeGwei = chain.defaultPriorityFeeGwei;
  }

  return { baseFeeGwei, priorityFeeGwei };
}

// ── USD price from CoinGecko ─────────────────────────────────────

const priceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Get native token price in USD from CoinGecko (simple/price API).
 * Cached for CACHE_TTL_MS to avoid rate limiting.
 */
async function getNativeUsdPrice(coingeckoId: string): Promise<number> {
  const cached = priceCache[coingeckoId];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.price;
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Fallback: use a reasonable default price
    console.warn(`CoinGecko fetch failed for ${coingeckoId}: ${res.status}`);
    return coingeckoId === "ethereum" ? 3500 : 1;
  }
  const data = (await res.json()) as Record<string, { usd?: number }>;
  const price = data[coingeckoId]?.usd ?? 3500;

  priceCache[coingeckoId] = { price, timestamp: Date.now() };
  return price;
}

// ── Busy level from base fee ─────────────────────────────────────

function computeBusyLevel(
  baseFeeGwei: number,
  chainName: string
): "low" | "medium" | "high" | "congested" {
  // Different thresholds per chain
  const thresholds: Record<string, [number, number, number]> = {
    ethereum: [20, 60, 150],
    base: [0.05, 0.2, 1],
    polygon: [30, 100, 300],
    arbitrum: [0.1, 0.5, 2],
    optimism: [0.01, 0.05, 0.2],
    bsc: [3, 10, 30],
    avalanche: [10, 30, 80],
    gnosis: [5, 15, 40],
  };
  const t = thresholds[chainName] ?? [10, 40, 100];
  if (baseFeeGwei < t[0]) return "low";
  if (baseFeeGwei < t[1]) return "medium";
  if (baseFeeGwei < t[2]) return "high";
  return "congested";
}

// ── Main estimation function ─────────────────────────────────────

export interface EstimateOptions {
  chainName: string;
  calldataSizeBytes: number;
  gasUnitsEst: number;
}

/**
 * Estimate gas cost for a single chain.
 */
export async function estimateChainGas(
  opts: EstimateOptions
): Promise<GasData> {
  const chain = CHAINS[opts.chainName];
  if (!chain) throw new Error(`Unknown chain: ${opts.chainName}`);

  // Fetch gas info
  const { baseFeeGwei, priorityFeeGwei } = await fetchEvmGas(chain);

  // Effective gas price (gwei)
  const effectiveGasPriceGwei = baseFeeGwei + priorityFeeGwei;

  // Total gas cost in wei
  const gasPriceWei = BigInt(Math.round(effectiveGasPriceGwei * 1e9));
  const totalWei = gasPriceWei * BigInt(opts.gasUnitsEst);

  // Native token price
  const nativeUsd = await getNativeUsdPrice(chain.coingeckoId);

  // Fee in native token — use enough decimals for small values
  const feeNativeDecimal = Number(totalWei) / 1e18;
  const feeNative =
    feeNativeDecimal < 0.001
      ? feeNativeDecimal.toFixed(10)
      : feeNativeDecimal.toFixed(6);

  // Fee in USD
  const feeUsd =
    feeNativeDecimal * nativeUsd < 0.01
      ? (feeNativeDecimal * nativeUsd).toFixed(6)
      : (feeNativeDecimal * nativeUsd).toFixed(2);

  // Busy level
  const busyLevel = computeBusyLevel(baseFeeGwei, opts.chainName);

  // Tip hint
  const tipHint = priorityFeeGwei.toFixed(4);

  return {
    chain: opts.chainName,
    baseFeeGwei,
    priorityFeeGwei,
    gasPriceWei: totalWei,
    nativeUsd,
    feeNative,
    feeUsd,
    busyLevel,
    tipHint,
  };
}

/**
 * Estimate gas across a set of chains and return the cheapest.
 */
export async function estimateGasRoute(
  chainSet: string[],
  calldataSizeBytes: number,
  gasUnitsEst: number
): Promise<GasEstimateResult> {
  if (chainSet.length === 0) {
    throw new Error("chain_set must not be empty");
  }

  // Fetch gas data for all requested chains in parallel
  const results = await Promise.all(
    chainSet.map((name) =>
      estimateChainGas({
        chainName: name,
        calldataSizeBytes,
        gasUnitsEst,
      }).catch((err) => {
        console.warn(`Failed to fetch gas for ${name}: ${err.message}`);
        return null as GasData | null;
      })
    )
  );

  // Filter out failed fetches
  const valid = results.filter((r): r is GasData => r !== null);
  if (valid.length === 0) {
    throw new Error(
      `Could not fetch gas data for any chain in set: [${chainSet.join(", ")}]`
    );
  }

  // Sort by fee (USD ascending)
  valid.sort((a, b) => Number(a.feeUsd) - Number(b.feeUsd));

  const best = valid[0];

  return {
    chain: best.chain,
    fee_native: best.feeNative,
    fee_usd: best.feeUsd,
    busy_level: best.busyLevel,
    tip_hint: best.tipHint,
  };
}
