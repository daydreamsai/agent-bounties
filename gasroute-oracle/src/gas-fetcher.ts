/**
 * Gas price fetching and fee estimation engine.
 * Queries live gas prices from chain RPCs and computes total tx costs.
 */

import { type ChainDef, SUPPORTED_CHAINS } from "./chains.js";

/** Gas data fetched from a chain */
export interface ChainGasData {
  chainId: string;
  baseFeeGwei: number;
  priorityFeeGwei: number;
  gasPrice: bigint; // wei
  pendingTxCount: number | null;
  timestamp: number;
}

/** Full estimate for a single chain */
export interface ChainEstimate {
  chain: string;
  fee_native: string;
  fee_usd: string;
  busy_level: "low" | "medium" | "high" | "very_high";
  tip_hint: string;
  gas_price_gwei: string;
  base_fee_gwei: string;
  priority_fee_gwei: string;
}

// Simple in-memory cache (5 min TTL)
const gasCache = new Map<string, { data: ChainGasData; expires: number }>();
const priceCache = new Map<string, { price: number; expires: number }>();

const CACHE_TTL_MS = 30_000; // 30s for gas data
const PRICE_CACHE_TTL_MS = 120_000; // 2 min for token prices

/**
 * JSON-RPC helper — tries RPCs in order until one works.
 */
async function rpcCall(
  rpcs: string[],
  method: string,
  params: unknown[] = []
): Promise<unknown> {
  let lastError: Error | null = null;
  for (const rpc of rpcs) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const json = (await res.json()) as {
        result?: unknown;
        error?: { message: string };
      };
      if (json.error) throw new Error(json.error.message);
      return json.result;
    } catch (e) {
      lastError = e as Error;
    }
  }
  throw lastError ?? new Error(`All RPCs failed for ${method}`);
}

/**
 * Fetch current gas data from a chain.
 */
export async function fetchGasData(chain: ChainDef): Promise<ChainGasData> {
  const cached = gasCache.get(chain.id);
  if (cached && cached.expires > Date.now()) return cached.data;

  const rpcs = chain.rpcs;

  // Fetch gas price and fee history in parallel
  const [gasPriceHex, feeHistoryRaw, pendingCountHex] = await Promise.all([
    rpcCall(rpcs, "eth_gasPrice") as Promise<string>,
    chain.eip1559
      ? (rpcCall(rpcs, "eth_feeHistory", [
          "0x4",
          "latest",
          [25, 50, 75],
        ]) as Promise<{
          baseFeePerGas: string[];
          reward: string[][];
        }>)
      : null,
    rpcCall(rpcs, "eth_getBlockByNumber", ["pending", false])
      .then((block: any) => block?.transactions?.length?.toString(16) ?? null)
      .catch(() => null) as Promise<string | null>,
  ]);

  const gasPrice = BigInt(gasPriceHex);
  let baseFeeGwei = Number(gasPrice) / 1e9;
  let priorityFeeGwei = 0;

  if (feeHistoryRaw && feeHistoryRaw.baseFeePerGas?.length > 0) {
    // Use latest base fee
    const latestBaseFee =
      feeHistoryRaw.baseFeePerGas[feeHistoryRaw.baseFeePerGas.length - 1];
    baseFeeGwei = Number(BigInt(latestBaseFee)) / 1e9;

    // Average the median (50th percentile) rewards
    const rewards = feeHistoryRaw.reward ?? [];
    if (rewards.length > 0) {
      const medianRewards = rewards.map((r) => Number(BigInt(r[1] ?? "0x0")));
      priorityFeeGwei =
        medianRewards.reduce((a, b) => a + b, 0) / medianRewards.length / 1e9;
    }
  }

  const pendingTxCount = pendingCountHex
    ? parseInt(pendingCountHex, 16)
    : null;

  const data: ChainGasData = {
    chainId: chain.id,
    baseFeeGwei,
    priorityFeeGwei,
    gasPrice,
    pendingTxCount,
    timestamp: Date.now(),
  };

  gasCache.set(chain.id, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

/**
 * Fetch native token price in USD from CoinGecko (free API).
 */
export async function fetchTokenPriceUsd(coingeckoId: string): Promise<number> {
  const cached = priceCache.get(coingeckoId);
  if (cached && cached.expires > Date.now()) return cached.price;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const json = (await res.json()) as Record<
      string,
      { usd: number } | undefined
    >;
    const price = json[coingeckoId]?.usd ?? 0;
    priceCache.set(coingeckoId, {
      price,
      expires: Date.now() + PRICE_CACHE_TTL_MS,
    });
    return price;
  } catch {
    // Fallback prices if CoinGecko is unavailable
    const fallback: Record<string, number> = {
      ethereum: 2100,
      "matic-network": 0.35,
    };
    return fallback[coingeckoId] ?? 0;
  }
}

/**
 * Determine network congestion level based on gas prices.
 */
function getBusyLevel(
  chain: ChainDef,
  gasData: ChainGasData
): "low" | "medium" | "high" | "very_high" {
  const totalGwei = gasData.baseFeeGwei + gasData.priorityFeeGwei;

  // Different thresholds per chain type
  if (chain.id === "ethereum") {
    if (totalGwei < 15) return "low";
    if (totalGwei < 40) return "medium";
    if (totalGwei < 100) return "high";
    return "very_high";
  }

  // L2s have much lower gas prices
  if (totalGwei < 0.01) return "low";
  if (totalGwei < 0.05) return "medium";
  if (totalGwei < 0.2) return "high";
  return "very_high";
}

/**
 * Compute a suggested priority fee (tip) based on network conditions.
 */
function computeTipHint(
  chain: ChainDef,
  gasData: ChainGasData
): string {
  const busyLevel = getBusyLevel(chain, gasData);

  // Suggest a multiplier on current priority fee
  let multiplier: number;
  switch (busyLevel) {
    case "low":
      multiplier = 1.0;
      break;
    case "medium":
      multiplier = 1.2;
      break;
    case "high":
      multiplier = 1.5;
      break;
    case "very_high":
      multiplier = 2.0;
      break;
  }

  const suggestedTip = Math.max(
    gasData.priorityFeeGwei * multiplier,
    chain.id === "ethereum" ? 0.1 : 0.001
  );

  return `${suggestedTip.toFixed(4)} gwei`;
}

/**
 * Estimate total fee for a transaction on a given chain.
 */
export async function estimateChainFee(
  chainId: string,
  calldataSizeBytes: number,
  gasUnitsEst: number
): Promise<ChainEstimate | null> {
  const chain = SUPPORTED_CHAINS[chainId];
  if (!chain) return null;

  try {
    const [gasData, tokenPriceUsd] = await Promise.all([
      fetchGasData(chain),
      fetchTokenPriceUsd(chain.coingeckoId),
    ]);

    // Calculate calldata gas cost (16 gas per non-zero byte, 4 per zero byte)
    // Estimate ~68% non-zero bytes on average
    const nonZeroBytes = Math.ceil(calldataSizeBytes * 0.68);
    const zeroBytes = calldataSizeBytes - nonZeroBytes;
    const calldataGas = nonZeroBytes * 16 + zeroBytes * 4;

    // Total gas = estimated gas units + calldata cost
    const totalGas = gasUnitsEst + calldataGas;

    // Effective gas price (base + priority)
    const effectiveGasPriceGwei =
      gasData.baseFeeGwei + gasData.priorityFeeGwei;
    const effectiveGasPriceWei = BigInt(
      Math.ceil(effectiveGasPriceGwei * 1e9)
    );

    // Total fee in wei
    const totalFeeWei = effectiveGasPriceWei * BigInt(totalGas);
    const totalFeeNative = Number(totalFeeWei) / 1e18;
    const totalFeeUsd = totalFeeNative * tokenPriceUsd;

    const busyLevel = getBusyLevel(chain, gasData);
    const tipHint = computeTipHint(chain, gasData);

    return {
      chain: chainId,
      fee_native: `${totalFeeNative.toFixed(8)} ${chain.nativeToken}`,
      fee_usd: `$${totalFeeUsd.toFixed(4)}`,
      busy_level: busyLevel,
      tip_hint: tipHint,
      gas_price_gwei: effectiveGasPriceGwei.toFixed(4),
      base_fee_gwei: gasData.baseFeeGwei.toFixed(4),
      priority_fee_gwei: gasData.priorityFeeGwei.toFixed(4),
    };
  } catch (e) {
    console.error(`Failed to estimate fee for ${chainId}:`, e);
    return null;
  }
}

/**
 * Find the cheapest chain from a set.
 */
export async function findCheapestChain(
  chainSet: string[],
  calldataSizeBytes: number,
  gasUnitsEst: number
): Promise<{
  recommendation: ChainEstimate;
  all_estimates: ChainEstimate[];
}> {
  const validChains = chainSet.filter((c) => c in SUPPORTED_CHAINS);
  if (validChains.length === 0) {
    throw new Error(
      `No supported chains in set. Supported: ${Object.keys(SUPPORTED_CHAINS).join(", ")}`
    );
  }

  const estimates = await Promise.all(
    validChains.map((c) => estimateChainFee(c, calldataSizeBytes, gasUnitsEst))
  );

  const valid = estimates.filter((e): e is ChainEstimate => e !== null);
  if (valid.length === 0) {
    throw new Error("Failed to get estimates from any chain");
  }

  // Sort by USD fee (ascending)
  valid.sort((a, b) => {
    const aUsd = parseFloat(a.fee_usd.replace("$", ""));
    const bUsd = parseFloat(b.fee_usd.replace("$", ""));
    return aUsd - bUsd;
  });

  return {
    recommendation: valid[0],
    all_estimates: valid,
  };
}
