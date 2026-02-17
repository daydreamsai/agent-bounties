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

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Convert a human-readable token amount (e.g. "100") to its smallest-unit
 * string representation using the given decimals.  Uses BigInt arithmetic
 * to avoid floating-point precision loss.
 */
function parseTokenAmount(amount, decimals = 6) {
  const str = String(amount).trim();
  const match = str.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error(`Invalid amount: ${amount}`);

  const whole = match[1];
  const frac = (match[2] || "").slice(0, decimals).padEnd(decimals, "0");
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac);
  if (raw <= 0n) throw new Error(`Invalid amount: ${amount}`);
  return raw.toString();
}

/**
 * Shared logic for all three entrypoints: resolve chains, parse amount,
 * and fetch bridge routes.
 */
async function resolveAndFetchRoutes(input) {
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

  return { fromChainId, toChainId, fromAmount, routes };
}

// ─── Shared input schema fields ───────────────────────────────────────
const baseInputSchema = z.object({
  token: z.string().describe("Token symbol or address to bridge (e.g. USDC, ETH, WETH)"),
  amount: z.string().describe("Amount to transfer (human-readable, e.g. '100' for 100 USDC)"),
  from_chain: z.string().describe("Source chain name or ID (e.g. ethereum, polygon, 42161)"),
  to_chain: z.string().describe("Destination chain name or ID (e.g. arbitrum, base, 137)"),
  decimals: z
    .number()
    .optional()
    .default(6)
    .describe("Token decimals (default 6 for USDC-like tokens, use 18 for ETH/WETH)"),
});

// ─── Entrypoint: get-routes ───────────────────────────────────────────
addEntrypoint({
  key: "get-routes",
  description:
    "Get all viable bridge routes with fees and timing for a cross-chain token transfer",
  input: baseInputSchema,
  async handler({ input }) {
    const { routes } = await resolveAndFetchRoutes(input);

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
  input: baseInputSchema,
  async handler({ input }) {
    const { routes } = await resolveAndFetchRoutes(input);

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
  input: baseInputSchema,
  async handler({ input }) {
    const { routes } = await resolveAndFetchRoutes(input);

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

// Only start the server when this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const { serve } = await import("@hono/node-server").catch(() => ({ serve: null }));
  if (serve) {
    serve({ fetch: app.fetch, port: Number(port) });
    console.log(`🌉 Bridge Route Pinger running on http://localhost:${port}`);
  } else {
    console.log("Agent app exported. Use a compatible runtime to serve.");
  }
}
