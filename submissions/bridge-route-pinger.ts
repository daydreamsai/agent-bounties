import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "0.1.0",
  description: "List viable bridge routes and live fee/time quotes for token transfers",
});

// Simulated bridge route data — in production, call real bridge APIs
const BRIDGE_ROUTES: Record<string, Array<{
  provider: string;
  type: string;
  baseFee: number;    // USD
  baseTime: number;   // minutes
  minAmount: number;
  maxAmount: number;
}>> = {
  "ETH:ARB": [
    { provider: "Across", type: "liquidity_pool", baseFee: 0.5, baseTime: 2, minAmount: 10, maxAmount: 100000 },
    { provider: "Arbitrum Bridge", type: "canonical", baseFee: 1.2, baseTime: 15, minAmount: 0, maxAmount: 1e9 },
    { provider: "Hop", type: "amm", baseFee: 0.3, baseTime: 3, minAmount: 5, maxAmount: 50000 },
  ],
  "ETH:BASE": [
    { provider: "Across", type: "liquidity_pool", baseFee: 0.4, baseTime: 2, minAmount: 10, maxAmount: 100000 },
    { provider: "Base Bridge", type: "canonical", baseFee: 0.8, baseTime: 10, minAmount: 0, maxAmount: 1e9 },
  ],
  "ETH:OP": [
    { provider: "Across", type: "liquidity_pool", baseFee: 0.5, baseTime: 3, minAmount: 10, maxAmount: 100000 },
    { provider: "Optimism Bridge", type: "canonical", baseFee: 1.0, baseTime: 20, minAmount: 0, maxAmount: 1e9 },
    { provider: "Hop", type: "amm", baseFee: 0.3, baseTime: 4, minAmount: 5, maxAmount: 50000 },
  ],
  "ARB:ETH": [
    { provider: "Across", type: "liquidity_pool", baseFee: 0.5, baseTime: 2, minAmount: 10, maxAmount: 100000 },
    { provider: "Arbitrum Bridge", type: "canonical", baseFee: 1.2, baseTime: 15, minAmount: 0, maxAmount: 1e9 },
  ],
};

const CHAIN_ALIASES: Record<string, string> = {
  "1": "ETH", "ethereum": "ETH", "mainnet": "ETH",
  "42161": "ARB", "arbitrum": "ARB", "arb": "ARB",
  "8453": "BASE", "base": "BASE",
  "10": "OP", "optimism": "OP",
};

function normalizeChain(input: string): string {
  return CHAIN_ALIASES[input.toLowerCase()] || input.toUpperCase();
}

function estimateFee(baseFee: number, amount: number): number {
  // Fee scales slightly with amount but has a floor
  const scaleFactor = Math.log2(Math.max(amount / 1000, 1));
  return parseFloat((baseFee + baseFee * 0.1 * scaleFactor).toFixed(2));
}

addEntrypoint({
  key: "bridge-routes",
  description: "Find bridge routes for a token transfer between chains",
  input: z.object({
    token: z.string().default("USDC"),
    amount: z.number().positive().default(1000),
    from_chain: z.string(),
    to_chain: z.string(),
  }),
  async handler({ input }) {
    const from = normalizeChain(input.from_chain);
    const to = normalizeChain(input.to_chain);
    const routeKey = `${from}:${to}`;
    const reverseKey = `${to}:${from}`;

    const candidates = BRIDGE_ROUTES[routeKey] || BRIDGE_ROUTES[reverseKey];
    if (!candidates) {
      return {
        output: {
          routes: [],
          note: `No bridge routes found for ${from} → ${to}`,
          supported_pairs: Object.keys(BRIDGE_ROUTES).map(k => k.replace(":", " → ")),
        },
        usage: { total_tokens: String(JSON.stringify(input).length) },
      };
    }

    const routes = candidates
      .filter(r => input.amount >= r.minAmount && input.amount <= r.maxAmount)
      .map(r => ({
        provider: r.provider,
        type: r.type,
        eta_minutes: r.baseTime,
        fee_usd: estimateFee(r.baseFee, input.amount),
        requirements: r.type === "liquidity_pool" ? [] : ["native gas token for destination"],
        direction: BRIDGE_ROUTES[routeKey] ? "forward" : "reverse",
      }))
      .sort((a, b) => a.fee_usd - b.fee_usd);

    return {
      output: {
        routes,
        from_chain: from,
        to_chain: to,
        token: input.token,
        amount: input.amount,
        best_route: routes[0] || null,
        total_routes: routes.length,
      },
      usage: { total_tokens: String(JSON.stringify(input).length) },
    };
  },
});

export default app;
