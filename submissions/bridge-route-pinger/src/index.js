import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { resolveChainId } from "./chains.js";
import { getBridgeRoutes } from "./lifi.js";

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "0.1.0",
  description:
    "List viable bridge routes and live fee/time quotes for cross-chain token transfers. Powered by LI.FI aggregator.",
});

// ─── Helper ───────────────────────────────────────────────────────────
function parseTokenAmount(amount, decimals = 6) {
  // Accept human-readable (e.g. "100") or raw wei strings
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) throw new Error(`Invalid amount: ${amount}`);
  // If the number looks like a human amount (< 1e12), convert to smallest unit
  if (num < 1e12) {
    return String(Math.round(num * 10 ** decimals));
  }
  return String(Math.round(num));
}

// ─── Entrypoint: get-routes ───────────────────────────────────────────
addEntrypoint({
  key: "get-routes",
  description:
    "Get all viable bridge routes with fees and timing for a cross-chain token transfer",
  input: z.object({
    token: z.string().describe("Token symbol or address to bridge (e.g. USDC, ETH, WETH)"),
    amount: z.string().describe("Amount to transfer (human-readable, e.g. '100' for 100 USDC)"),
    from_chain: z.string().describe("Source chain name or ID (e.g. ethereum, polygon, 42161)"),
    to_chain: z.string().describe("Destination chain name or ID (e.g. arbitrum, base, 137)"),
    decimals: z
      .number()
      .optional()
      .default(6)
      .describe("Token decimals (default 6 for USDC-like tokens, use 18 for ETH/WETH)"),
  }),
  async handler({ input }) {
    const fromChainId = resolveChainId(input.from_chain);
    const toChainId = resolveChainId(input.to_chain);
    if (!fromChainId) throw new Error(`Unknown source chain: ${input.from_chain}`);
    if (!toChainId) throw new Error(`Unknown destination chain: ${input.to_chain}`);

    const fromAmount = parseTokenAmount(input.amount, input.decimals ?? 6);
    const routes = await getBridgeRoutes({
      fromChainId,
      toChainId,
      fromToken: input.token,
      toToken: input.token,
      fromAmount,
    });

    return {
      output: {
        query: {
          token: input.token,
          amount: input.amount,
          from_chain: input.from_chain,
          to_chain: input.to_chain,
        },
        route_count: routes.length,
        routes,
      },
      usage: { total_tokens: JSON.stringify(routes).length },
    };
  },
});

// ─── Entrypoint: compare-fees ─────────────────────────────────────────
addEntrypoint({
  key: "compare-fees",
  description:
    "Compare bridge fees across all available routes, sorted by lowest fee first",
  input: z.object({
    token: z.string().describe("Token symbol or address to bridge"),
    amount: z.string().describe("Amount to transfer (human-readable)"),
    from_chain: z.string().describe("Source chain name or ID"),
    to_chain: z.string().describe("Destination chain name or ID"),
    decimals: z.number().optional().default(6).describe("Token decimals (default 6)"),
  }),
  async handler({ input }) {
    const fromChainId = resolveChainId(input.from_chain);
    const toChainId = resolveChainId(input.to_chain);
    if (!fromChainId) throw new Error(`Unknown source chain: ${input.from_chain}`);
    if (!toChainId) throw new Error(`Unknown destination chain: ${input.to_chain}`);

    const fromAmount = parseTokenAmount(input.amount, input.decimals ?? 6);
    const routes = await getBridgeRoutes({
      fromChainId,
      toChainId,
      fromToken: input.token,
      toToken: input.token,
      fromAmount,
    });

    const sorted = routes.sort((a, b) => a.fee_usd - b.fee_usd);
    const cheapest = sorted[0] || null;

    return {
      output: {
        query: { token: input.token, amount: input.amount, from_chain: input.from_chain, to_chain: input.to_chain },
        cheapest_route: cheapest
          ? { bridge: cheapest.bridge, fee_usd: cheapest.fee_usd, to_amount: cheapest.to_amount }
          : null,
        all_routes: sorted.map((r) => ({
          bridge: r.bridge,
          fee_usd: r.fee_usd,
          gas_usd: r.gas_usd,
          to_amount: r.to_amount,
          eta_minutes: r.eta_minutes,
        })),
      },
      usage: { total_tokens: JSON.stringify(sorted).length },
    };
  },
});

// ─── Entrypoint: estimate-time ────────────────────────────────────────
addEntrypoint({
  key: "estimate-time",
  description:
    "Estimate transfer times across all bridge routes, sorted by fastest first",
  input: z.object({
    token: z.string().describe("Token symbol or address to bridge"),
    amount: z.string().describe("Amount to transfer (human-readable)"),
    from_chain: z.string().describe("Source chain name or ID"),
    to_chain: z.string().describe("Destination chain name or ID"),
    decimals: z.number().optional().default(6).describe("Token decimals (default 6)"),
  }),
  async handler({ input }) {
    const fromChainId = resolveChainId(input.from_chain);
    const toChainId = resolveChainId(input.to_chain);
    if (!fromChainId) throw new Error(`Unknown source chain: ${input.from_chain}`);
    if (!toChainId) throw new Error(`Unknown destination chain: ${input.to_chain}`);

    const fromAmount = parseTokenAmount(input.amount, input.decimals ?? 6);
    const routes = await getBridgeRoutes({
      fromChainId,
      toChainId,
      fromToken: input.token,
      toToken: input.token,
      fromAmount,
    });

    const sorted = routes.sort((a, b) => a.eta_seconds - b.eta_seconds);
    const fastest = sorted[0] || null;

    return {
      output: {
        query: { token: input.token, amount: input.amount, from_chain: input.from_chain, to_chain: input.to_chain },
        fastest_route: fastest
          ? { bridge: fastest.bridge, eta_minutes: fastest.eta_minutes, fee_usd: fastest.fee_usd }
          : null,
        all_routes: sorted.map((r) => ({
          bridge: r.bridge,
          eta_minutes: r.eta_minutes,
          eta_seconds: r.eta_seconds,
          fee_usd: r.fee_usd,
          to_amount: r.to_amount,
        })),
      },
      usage: { total_tokens: JSON.stringify(sorted).length },
    };
  },
});

// ─── Start server ─────────────────────────────────────────────────────
const port = process.env.PORT || 3000;

export default app;

// If run directly, start the server
const { serve } = await import("@hono/node-server").catch(() => ({ serve: null }));
if (serve) {
  serve({ fetch: app.fetch, port: Number(port) });
  console.log(`🌉 Bridge Route Pinger running on http://localhost:${port}`);
} else {
  console.log("Agent app exported. Use a compatible runtime to serve.");
}
