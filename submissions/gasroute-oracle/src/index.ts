/**
 * GasRoute Oracle Agent
 *
 * Returns best chain and time estimate for given gas load.
 * Fetches live gas prices across multiple chains via free APIs.
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/4
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChainGasData {
  chain: string;
  chain_id: number;
  fee_native: number;
  fee_usd: number;
  gas_price_gwei: number;
  base_fee_gwei: number | null;
  priority_fee_gwei: number | null;
  busy_level: "low" | "medium" | "high" | "very_high";
  tip_hint: string;
  block_time_seconds: number;
  congestion_score: number;
}

// Chain metadata
const CHAINS: Record<
  string,
  {
    id: number;
    name: string;
    native: string;
    native_price_usd: number;
    block_time: number;
  }
> = {
  ethereum: { id: 1, name: "Ethereum", native: "ETH", native_price_usd: 3200, block_time: 12 },
  polygon: { id: 137, name: "Polygon", native: "MATIC", native_price_usd: 0.85, block_time: 2 },
  bsc: { id: 56, name: "BNB Smart Chain", native: "BNB", native_price_usd: 580, block_time: 3 },
  arbitrum: { id: 42161, name: "Arbitrum One", native: "ETH", native_price_usd: 3200, block_time: 0.26 },
  optimism: { id: 10, name: "Optimism", native: "ETH", native_price_usd: 3200, block_time: 2 },
  base: { id: 8453, name: "Base", native: "ETH", native_price_usd: 3200, block_time: 2 },
  avalanche: { id: 43114, name: "Avalanche", native: "AVAX", native_price_usd: 38, block_time: 2 },
};

// ─── Price Fetching ────────────────────────────────────────────────────────────

async function fetchNativePrices(): Promise<void> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,matic-network,binancecoin,avalanche-2&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return;
    const data = await res.json() as Record<string, { usd: number }>;
    if (data.ethereum?.usd) {
      CHAINS.ethereum.native_price_usd = data.ethereum.usd;
      CHAINS.arbitrum.native_price_usd = data.ethereum.usd;
      CHAINS.optimism.native_price_usd = data.ethereum.usd;
      CHAINS.base.native_price_usd = data.ethereum.usd;
    }
    if (data["matic-network"]?.usd) CHAINS.polygon.native_price_usd = data["matic-network"].usd;
    if (data.binancecoin?.usd) CHAINS.bsc.native_price_usd = data.binancecoin.usd;
    if (data["avalanche-2"]?.usd) CHAINS.avalanche.native_price_usd = data["avalanche-2"].usd;
  } catch {
    // Use defaults on failure
  }
}

// ─── Gas Fetching ─────────────────────────────────────────────────────────────

async function fetchBlocknativeGas(
  chainId: number
): Promise<{ baseFee: number; priority: number } | null> {
  try {
    const res = await fetch(
      `https://api.blocknative.com/gasprices/blockprices?chainid=${chainId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      blockPrices?: Array<{
        baseFeePerGas?: number;
        estimatedPrices?: Array<{ maxPriorityFeePerGas?: number }>;
      }>;
    };
    const block = data.blockPrices?.[0];
    if (!block) return null;
    return {
      baseFee: block.baseFeePerGas || 0,
      priority: block.estimatedPrices?.[0]?.maxPriorityFeePerGas || 1,
    };
  } catch {
    return null;
  }
}

async function fetchEtherscanGas(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.etherscan.io/api?module=gastracker&action=gasoracle",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      result?: { ProposeGasPrice?: string };
    };
    return parseFloat(data.result?.ProposeGasPrice || "0") || null;
  } catch {
    return null;
  }
}

async function fetchPolygonGas(): Promise<{ baseFee: number; priority: number } | null> {
  try {
    const res = await fetch("https://gasstation.polygon.technology/v2", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      fast?: { maxFee?: number; maxPriorityFee?: number };
    };
    const tier = data.fast;
    if (!tier) return null;
    return {
      baseFee: (tier.maxFee || 50) - (tier.maxPriorityFee || 30),
      priority: tier.maxPriorityFee || 30,
    };
  } catch {
    return null;
  }
}

// Chain-specific congestion thresholds (gwei)
const THRESHOLDS: Record<string, [number, number, number]> = {
  ethereum: [15, 40, 80],
  polygon: [50, 100, 200],
  bsc: [5, 10, 20],
  arbitrum: [0.5, 1, 2],
  optimism: [0.01, 0.05, 0.1],
  base: [0.01, 0.05, 0.1],
  avalanche: [30, 60, 120],
};

async function getChainGasData(
  chainName: string,
  calldataBytes: number,
  gasUnitsEst: number
): Promise<ChainGasData> {
  const chainKey = chainName.toLowerCase();
  const chainMeta = CHAINS[chainKey];
  if (!chainMeta) throw new Error(`Unknown chain: ${chainName}`);

  let gasPriceGwei = 10;
  let baseFeeGwei: number | null = null;
  let priorityFeeGwei: number | null = null;

  if (chainKey === "ethereum") {
    const ethGas = await fetchEtherscanGas();
    if (ethGas) gasPriceGwei = ethGas;
    const bnGas = await fetchBlocknativeGas(1);
    if (bnGas) {
      baseFeeGwei = bnGas.baseFee;
      priorityFeeGwei = bnGas.priority;
      gasPriceGwei = bnGas.baseFee + bnGas.priority;
    }
  } else if (chainKey === "polygon") {
    const polyGas = await fetchPolygonGas();
    if (polyGas) {
      baseFeeGwei = polyGas.baseFee;
      priorityFeeGwei = polyGas.priority;
      gasPriceGwei = polyGas.baseFee + polyGas.priority;
    }
  } else {
    const bnGas = await fetchBlocknativeGas(chainMeta.id);
    if (bnGas) {
      baseFeeGwei = bnGas.baseFee;
      priorityFeeGwei = bnGas.priority;
      gasPriceGwei = bnGas.baseFee + bnGas.priority;
    } else {
      // Fallback defaults
      const defaults: Record<string, number> = {
        arbitrum: 0.15,
        optimism: 0.001,
        base: 0.001,
        bsc: 3,
        avalanche: 25,
      };
      gasPriceGwei = defaults[chainKey] || 10;
    }
  }

  const calldataGas = calldataBytes * 10;
  const totalGasUnits = gasUnitsEst + calldataGas;
  const feeNative = totalGasUnits * gasPriceGwei * 1e-9;
  const feeUsd = feeNative * chainMeta.native_price_usd;

  const [low, med, high] = THRESHOLDS[chainKey] || [10, 30, 60];
  let busyLevel: "low" | "medium" | "high" | "very_high" = "low";
  let congestionScore = 0;
  if (gasPriceGwei <= low) {
    busyLevel = "low";
    congestionScore = Math.round((gasPriceGwei / low) * 25);
  } else if (gasPriceGwei <= med) {
    busyLevel = "medium";
    congestionScore = 25 + Math.round(((gasPriceGwei - low) / (med - low)) * 25);
  } else if (gasPriceGwei <= high) {
    busyLevel = "high";
    congestionScore = 50 + Math.round(((gasPriceGwei - med) / (high - med)) * 25);
  } else {
    busyLevel = "very_high";
    congestionScore = Math.min(100, 75 + Math.round(((gasPriceGwei - high) / high) * 25));
  }

  let tipHint = "";
  if (baseFeeGwei !== null && priorityFeeGwei !== null) {
    const mult = busyLevel === "low" ? 1.1 : busyLevel === "medium" ? 1.2 : 1.5;
    const priMult = busyLevel === "low" ? 1 : busyLevel === "medium" ? 1.2 : 2;
    tipHint = `maxFee=${(baseFeeGwei * mult + priorityFeeGwei * priMult).toFixed(2)} gwei, priority=${(priorityFeeGwei * priMult).toFixed(2)} gwei`;
  } else {
    tipHint = busyLevel === "low"
      ? `${gasPriceGwei.toFixed(2)} gwei — good time to transact`
      : busyLevel === "medium"
      ? `${gasPriceGwei.toFixed(2)} gwei — moderate, consider waiting`
      : `${gasPriceGwei.toFixed(2)} gwei — HIGH congestion, wait if possible`;
  }

  return {
    chain: chainMeta.name,
    chain_id: chainMeta.id,
    fee_native: feeNative,
    fee_usd: feeUsd,
    gas_price_gwei: gasPriceGwei,
    base_fee_gwei: baseFeeGwei,
    priority_fee_gwei: priorityFeeGwei,
    busy_level: busyLevel,
    tip_hint: tipHint,
    block_time_seconds: chainMeta.block_time,
    congestion_score: congestionScore,
  };
}

// ─── Agent App ────────────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "gasroute-oracle",
  version: "1.0.0",
  description: "Returns cheapest chain and timing hint for a swap or contract call. Fetches live gas prices across Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, and Avalanche.",
});

addEntrypoint({
  key: "get_gas_route",
  description:
    "Returns the cheapest chain and timing hint for a swap or contract call. Fetches live gas prices and recommends optimal chain.",
  input: z.object({
    chain_set: z
      .array(z.string())
      .default(["ethereum", "polygon", "arbitrum", "optimism", "base", "bsc"])
      .describe("Chains to evaluate: ethereum, polygon, arbitrum, optimism, base, bsc, avalanche"),
    calldata_size_bytes: z
      .number()
      .default(256)
      .describe("Estimated calldata size in bytes"),
    gas_units_est: z
      .number()
      .default(150000)
      .describe("Estimated gas units for the operation (transfer=21000, swap=~150000)"),
  }),
  async handler({ input }) {
    const { chain_set, calldata_size_bytes, gas_units_est } = input;

    await fetchNativePrices();

    const validChains = chain_set.filter((c) => CHAINS[c.toLowerCase()]);
    if (validChains.length === 0) {
      throw new Error(`No valid chains. Valid: ${Object.keys(CHAINS).join(", ")}`);
    }

    const results = await Promise.allSettled(
      validChains.map((c) => getChainGasData(c, calldata_size_bytes, gas_units_est))
    );

    const successful: ChainGasData[] = results
      .filter((r): r is PromiseFulfilledResult<ChainGasData> => r.status === "fulfilled")
      .map((r) => r.value);

    if (successful.length === 0) throw new Error("Failed to fetch gas data for all chains");

    const sorted = successful.sort((a, b) => {
      const scoreA = a.fee_usd * (1 + a.congestion_score / 100);
      const scoreB = b.fee_usd * (1 + b.congestion_score / 100);
      return scoreA - scoreB;
    });

    const best = sorted[0];
    const alternatives = sorted.slice(1, 4);

    return {
      output: {
        chain: best.chain,
        fee_native: parseFloat(best.fee_native.toFixed(8)),
        fee_usd: parseFloat(best.fee_usd.toFixed(4)),
        busy_level: best.busy_level,
        tip_hint: best.tip_hint,
        block_time_seconds: best.block_time_seconds,
        gas_price_gwei: parseFloat(best.gas_price_gwei.toFixed(4)),
        base_fee_gwei: best.base_fee_gwei !== null ? parseFloat(best.base_fee_gwei.toFixed(4)) : null,
        priority_fee_gwei: best.priority_fee_gwei !== null ? parseFloat(best.priority_fee_gwei.toFixed(4)) : null,
        alternatives: alternatives.map((c) => ({
          chain: c.chain,
          fee_usd: parseFloat(c.fee_usd.toFixed(4)),
          busy_level: c.busy_level,
          gas_price_gwei: parseFloat(c.gas_price_gwei.toFixed(4)),
        })),
        inputs: { calldata_size_bytes, gas_units_est },
        chains_evaluated: successful.length,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: String(successful.length) },
    };
  },
});

addEntrypoint({
  key: "get_chain_gas",
  description: "Get current gas price and busy level for a single chain",
  input: z.object({
    chain: z
      .string()
      .default("ethereum")
      .describe("Chain: ethereum, polygon, arbitrum, optimism, base, bsc, avalanche"),
  }),
  async handler({ input }) {
    const { chain } = input;
    await fetchNativePrices();
    const data = await getChainGasData(chain, 256, 21000);
    return {
      output: {
        chain: data.chain,
        chain_id: data.chain_id,
        gas_price_gwei: parseFloat(data.gas_price_gwei.toFixed(4)),
        base_fee_gwei: data.base_fee_gwei !== null ? parseFloat(data.base_fee_gwei.toFixed(4)) : null,
        priority_fee_gwei: data.priority_fee_gwei !== null ? parseFloat(data.priority_fee_gwei.toFixed(4)) : null,
        busy_level: data.busy_level,
        congestion_score: data.congestion_score,
        tip_hint: data.tip_hint,
        simple_transfer_fee_usd: parseFloat(data.fee_usd.toFixed(4)),
        block_time_seconds: data.block_time_seconds,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: "1" },
    };
  },
});

addEntrypoint({
  key: "echo",
  description: "Health check",
  input: z.object({ text: z.string().optional() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "gasroute-oracle online") },
      usage: { total_tokens: "1" },
    };
  },
});

const PORT = parseInt(process.env.PORT ?? "8091");
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`GasRoute Oracle running on http://0.0.0.0:${info.port}`);
});

export default app;
