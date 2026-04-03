/**
 * GasRoute Oracle Agent
 *
 * Finds the cheapest chain for transactions by comparing real-time gas prices
 * across Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, and Avalanche.
 *
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/4
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GasInfo {
  chain: string;
  chain_id: number;
  gas_price_gwei: number;
  native_token: string;
  native_price_usd: number;
  simple_transfer_cost_usd: number;
  erc20_transfer_cost_usd: number;
  swap_cost_usd: number;
  timestamp_utc: string;
}

// ─── Chain Configs ────────────────────────────────────────────────────────────

const CHAINS = [
  { name: "Ethereum", id: 1, rpc: "https://eth.llamarpc.com", native: "ETH", cgId: "ethereum" },
  { name: "Polygon", id: 137, rpc: "https://polygon.llamarpc.com", native: "MATIC", cgId: "matic-network" },
  { name: "Arbitrum", id: 42161, rpc: "https://arbitrum.llamarpc.com", native: "ETH", cgId: "ethereum" },
  { name: "Optimism", id: 10, rpc: "https://optimism.llamarpc.com", native: "ETH", cgId: "ethereum" },
  { name: "Base", id: 8453, rpc: "https://base.llamarpc.com", native: "ETH", cgId: "ethereum" },
  { name: "BSC", id: 56, rpc: "https://bsc.llamarpc.com", native: "BNB", cgId: "binancecoin" },
  { name: "Avalanche", id: 43114, rpc: "https://avalanche.llamarpc.com", native: "AVAX", cgId: "avalanche-2" },
] as const;

const GAS_UNITS = { simple_transfer: 21000, erc20_transfer: 65000, swap: 150000 };

// ─── Price Cache ──────────────────────────────────────────────────────────────

let priceCache: Record<string, number> = {};
let priceCacheTime = 0;

async function fetchPrices(): Promise<Record<string, number>> {
  if (Date.now() - priceCacheTime < 60_000 && Object.keys(priceCache).length > 0) return priceCache;
  const ids = [...new Set(CHAINS.map((c) => c.cgId))].join(",");
  try {
    const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
    const data = (await resp.json()) as Record<string, { usd: number }>;
    priceCache = {};
    for (const [id, val] of Object.entries(data)) priceCache[id] = val.usd;
    priceCacheTime = Date.now();
  } catch (e) { console.error("Price fetch failed:", e); }
  return priceCache;
}

async function fetchGasPrice(rpc: string): Promise<number> {
  try {
    const resp = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] }),
    });
    const data = (await resp.json()) as { result: string };
    return parseInt(data.result, 16) / 1e9;
  } catch { return -1; }
}

async function getGasInfo(chain: typeof CHAINS[number], prices: Record<string, number>): Promise<GasInfo> {
  const gwei = await fetchGasPrice(chain.rpc);
  const nativePrice = prices[chain.cgId] || 0;
  const gasEth = gwei / 1e9;
  const cost = (units: number) => Math.round(gasEth * units * nativePrice * 10000) / 10000;
  return {
    chain: chain.name, chain_id: chain.id, gas_price_gwei: Math.round(gwei * 1000) / 1000,
    native_token: chain.native, native_price_usd: nativePrice,
    simple_transfer_cost_usd: cost(GAS_UNITS.simple_transfer),
    erc20_transfer_cost_usd: cost(GAS_UNITS.erc20_transfer),
    swap_cost_usd: cost(GAS_UNITS.swap),
    timestamp_utc: new Date().toISOString(),
  };
}

async function getAllGas(chainNames?: string[]): Promise<GasInfo[]> {
  const prices = await fetchPrices();
  const targets = chainNames?.length
    ? CHAINS.filter((c) => chainNames.some((n) => c.name.toLowerCase() === n.toLowerCase()))
    : [...CHAINS];
  const results = await Promise.allSettled(targets.map((c) => getGasInfo(c, prices)));
  return results.filter((r): r is PromiseFulfilledResult<GasInfo> => r.status === "fulfilled")
    .map((r) => r.value).filter((g) => g.gas_price_gwei >= 0);
}

// ─── Agent App ────────────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "GasRoute Oracle",
  description: "Find the cheapest chain for transactions. Compares real-time gas prices across Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, and Avalanche.",
});

// Action: get_gas_prices
addEntrypoint({
  key: "get_gas_prices",
  description: "Get current gas prices across all supported chains, or filter by chain name.",
  input: z.object({
    chains: z.array(z.string()).optional().describe("Optional list of chain names."),
  }),
  output: z.object({
    chains: z.array(z.any()),
    timestamp: z.string(),
  }),
  handler: async (ctx) => {
    const input = ctx.input as { chains?: string[] };
    const gasInfos = await getAllGas(input.chains);
    return { output: { chains: gasInfos, timestamp: new Date().toISOString() } };
  },
});

// Action: find_cheapest
addEntrypoint({
  key: "find_cheapest",
  description: "Find the cheapest chain for a specific transaction type with savings vs Ethereum.",
  input: z.object({
    tx_type: z.enum(["simple_transfer", "erc20_transfer", "swap"]).describe("Transaction type."),
    chains: z.array(z.string()).optional().describe("Optional chain filter."),
  }),
  output: z.object({ recommendation: z.any() }),
  handler: async (ctx) => {
    const input = ctx.input as { tx_type: string; chains?: string[] };
    const gasInfos = await getAllGas(input.chains);
    const costKey = input.tx_type === "swap" ? "swap_cost_usd"
      : input.tx_type === "erc20_transfer" ? "erc20_transfer_cost_usd"
      : "simple_transfer_cost_usd";
    const sorted = [...gasInfos].sort((a, b) => (a as any)[costKey] - (b as any)[costKey]);
    const cheapest = sorted[0];
    const eth = gasInfos.find((g) => g.chain === "Ethereum");
    const cheapCost = (cheapest as any)[costKey] as number;
    const ethCost = eth ? (eth as any)[costKey] as number : cheapCost;
    return {
      output: {
        recommendation: {
          cheapest_chain: cheapest.chain,
          cheapest_cost_usd: cheapCost,
          all_chains: sorted,
          tx_type: input.tx_type,
          savings_vs_ethereum_usd: Math.round((ethCost - cheapCost) * 10000) / 10000,
          savings_vs_ethereum_pct: ethCost > 0 ? Math.round(((ethCost - cheapCost) / ethCost) * 10000) / 100 : 0,
        },
      },
    };
  },
});

// Action: compare_chains
addEntrypoint({
  key: "compare_chains",
  description: "Compare gas costs between two specific chains for all transaction types.",
  input: z.object({
    chain_a: z.string().describe("First chain name."),
    chain_b: z.string().describe("Second chain name."),
  }),
  output: z.object({ comparison: z.any() }),
  handler: async (ctx) => {
    const input = ctx.input as { chain_a: string; chain_b: string };
    const gasInfos = await getAllGas([input.chain_a, input.chain_b]);
    if (gasInfos.length < 2) {
      return { output: { comparison: { error: "One or both chains not found.", available: CHAINS.map((c) => c.name) } } };
    }
    const [a, b] = gasInfos;
    return {
      output: {
        comparison: {
          chain_a: a, chain_b: b,
          simple_transfer: { cheaper: a.simple_transfer_cost_usd <= b.simple_transfer_cost_usd ? a.chain : b.chain, diff_usd: Math.abs(a.simple_transfer_cost_usd - b.simple_transfer_cost_usd) },
          erc20_transfer: { cheaper: a.erc20_transfer_cost_usd <= b.erc20_transfer_cost_usd ? a.chain : b.chain, diff_usd: Math.abs(a.erc20_transfer_cost_usd - b.erc20_transfer_cost_usd) },
          swap: { cheaper: a.swap_cost_usd <= b.swap_cost_usd ? a.chain : b.chain, diff_usd: Math.abs(a.swap_cost_usd - b.swap_cost_usd) },
        },
      },
    };
  },
});

// Action: echo (health check)
addEntrypoint({
  key: "echo",
  description: "Health check.",
  input: z.object({ message: z.string().optional() }),
  output: z.object({ message: z.string(), status: z.string() }),
  handler: async (ctx) => {
    const input = ctx.input as { message?: string };
    return { output: { message: input.message || "GasRoute Oracle is live!", status: "ok" } };
  },
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "8094");
serve({ fetch: app.fetch, port: PORT });
console.log(`🛣️  GasRoute Oracle on http://localhost:${PORT}`);
