import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { getQuotes, type DexQuote } from "./dex-quotes.js";

const { app, addEntrypoint } = createAgentApp({
  name: "cross-dex-arbitrage-alert",
  version: "1.0.0",
  description:
    "Detect cross-DEX token price spreads exceeding a threshold. Compares quotes across Uniswap V3, Aerodrome, SushiSwap, and more.",
});

addEntrypoint({
  key: "scan",
  description: "Scan for cross-DEX arbitrage opportunities on a given pair",
  input: z.object({
    token_in: z.string().describe("Input token address"),
    token_out: z.string().describe("Output token address"),
    amount_in: z.string().describe("Amount of input token (in wei/smallest unit)"),
    chains: z
      .array(z.number())
      .optional()
      .default([8453])
      .describe("Chain IDs to scan (default: [8453] Base)"),
    min_spread_bps: z
      .number()
      .optional()
      .default(10)
      .describe("Minimum spread in basis points to flag (default: 10)"),
  }),
  output: z.object({
    token_in: z.string(),
    token_out: z.string(),
    amount_in: z.string(),
    best_route: z.object({
      dex: z.string(),
      chain_id: z.number(),
      amount_out: z.string(),
      price: z.number(),
    }),
    alt_routes: z.array(
      z.object({
        dex: z.string(),
        chain_id: z.number(),
        amount_out: z.string(),
        price: z.number(),
        spread_bps: z.number(),
      })
    ),
    net_spread_bps: z.number(),
    est_fill_cost_usd: z.number(),
    profitable: z.boolean(),
    summary: z.string(),
  }),
  async handler({ input }) {
    const quotes = await getQuotes(
      input.token_in,
      input.token_out,
      BigInt(input.amount_in),
      input.chains ?? [8453]
    );

    if (quotes.length === 0) {
      return {
        output: {
          token_in: input.token_in,
          token_out: input.token_out,
          amount_in: input.amount_in,
          best_route: { dex: "none", chain_id: 0, amount_out: "0", price: 0 },
          alt_routes: [],
          net_spread_bps: 0,
          est_fill_cost_usd: 0,
          profitable: false,
          summary: "No quotes available for this pair.",
        },
        usage: { total_tokens: 1 },
      };
    }

    // Sort by amount_out descending (best first)
    quotes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1));

    const best = quotes[0];
    const bestPrice = Number(best.amountOut) / Number(BigInt(input.amount_in));

    const altRoutes = quotes.slice(1).map((q) => {
      const price = Number(q.amountOut) / Number(BigInt(input.amount_in));
      const spreadBps = Math.round(((bestPrice - price) / bestPrice) * 10000);
      return {
        dex: q.dex,
        chain_id: q.chainId,
        amount_out: q.amountOut.toString(),
        price,
        spread_bps: spreadBps,
      };
    });

    const worst = quotes[quotes.length - 1];
    const worstPrice = Number(worst.amountOut) / Number(BigInt(input.amount_in));
    const netSpreadBps = Math.round(((bestPrice - worstPrice) / bestPrice) * 10000);

    // Estimate gas cost on Base (~$0.01 per swap)
    const estFillCostUsd = 0.02; // Two swaps on Base L2

    const profitable = netSpreadBps > (input.min_spread_bps ?? 10) && netSpreadBps * Number(BigInt(input.amount_in)) / 1e18 * 2000 / 10000 > estFillCostUsd;

    const summary = `Scanned ${quotes.length} DEXes. Best: ${best.dex} (${bestPrice.toFixed(6)}). ` +
      `Spread: ${netSpreadBps} bps. ${profitable ? "⚡ PROFITABLE opportunity!" : "Not profitable after gas."}`;

    return {
      output: {
        token_in: input.token_in,
        token_out: input.token_out,
        amount_in: input.amount_in,
        best_route: {
          dex: best.dex,
          chain_id: best.chainId,
          amount_out: best.amountOut.toString(),
          price: bestPrice,
        },
        alt_routes: altRoutes,
        net_spread_bps: netSpreadBps,
        est_fill_cost_usd: estFillCostUsd,
        profitable,
        summary,
      },
      usage: { total_tokens: 1 },
    };
  },
});

addEntrypoint({
  key: "health",
  description: "Health check",
  input: z.object({}),
  async handler() {
    return {
      output: {
        status: "ok",
        supported_dexes: ["uniswap_v3", "aerodrome", "sushiswap_v3"],
        supported_chains: [{ id: 8453, name: "base" }],
        version: "1.0.0",
      },
      usage: { total_tokens: 0 },
    };
  },
});

export default app;
