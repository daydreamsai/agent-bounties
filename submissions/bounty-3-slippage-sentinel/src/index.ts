import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { analyzeSlippage } from "./slippage.js";

const { app, addEntrypoint } = createAgentApp({
  name: "slippage-sentinel",
  version: "1.0.0",
  description:
    "Estimate safe slippage tolerance for any swap route to prevent reverts",
});

addEntrypoint({
  key: "analyze",
  description: "Suggest safe slippage for a specific swap route",
  input: z.object({
    token_in: z.string().describe("Input token address"),
    token_out: z.string().describe("Output token address"),
    amount_in: z.string().describe("Amount to swap (in wei)"),
    chain_id: z.number().optional().default(8453).describe("Chain ID (default: Base)"),
    route_hint: z.string().optional().describe("Suggested route/DEX"),
  }),
  output: z.object({
    min_safe_slip_bps: z.number(),
    recommended_slip_bps: z.number(),
    pool_depths: z.array(
      z.object({
        dex: z.string(),
        fee_tier: z.number(),
        liquidity: z.string(),
        price_impact_bps: z.number(),
      })
    ),
    recent_trade_size_p95: z.number(),
    volatility_24h_bps: z.number(),
    risk_level: z.enum(["low", "medium", "high", "extreme"]),
    summary: z.string(),
  }),
  async handler({ input }) {
    const result = await analyzeSlippage(
      input.token_in,
      input.token_out,
      BigInt(input.amount_in),
      input.chain_id ?? 8453,
      input.route_hint
    );

    return {
      output: result,
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
        supported_chains: [{ id: 8453, name: "base" }],
        version: "1.0.0",
      },
      usage: { total_tokens: 0 },
    };
  },
});

export default app;
