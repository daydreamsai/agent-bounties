import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { analyzeSlippage } from "./logic.js";

// Note: The agent-kit SDK's .d.ts files reference an internal zod build whose
// ZodObject type is structurally incompatible with the project-level zod.
// The runtime behaviour is fully correct; the `as any` casts silence the
// type-checker for the SDK boundary only.

if (!process.env.ADDRESS) {
  throw new Error(
    "ADDRESS environment variable is required. Refusing to start with the zero address to prevent burning payments."
  );
}

const { app, addEntrypoint } = createAgentApp(
  {
    name: "slippage-sentinel",
    version: "1.0.0",
    description: "Estimate safe slippage tolerance for any swap route",
  },
  {
    payments: {
      payTo: process.env.ADDRESS as `0x${string}`,
      network: (process.env.NETWORK as any) || "base-sepolia",
      defaultPrice: process.env.DEFAULT_PRICE || "1000",
    } as any,
  }
);

addEntrypoint({
  key: "analyze",
  description: "Analyze slippage for a token swap route",
  input: z.object({
    token_in: z.string().describe("Input token address"),
    token_out: z.string().describe("Output token address"),
    amount_in: z.string().describe("Amount to swap in wei"),
    route_hint: z
      .string()
      .optional()
      .describe("DEX hint e.g. uniswap_v3"),
  }),
  output: z.object({
    min_safe_slip_bps: z.number(),
    recommended_slip_bps: z.number(),
    pool_depths: z.array(
      z.object({
        fee_tier: z.number(),
        liquidity: z.string(),
        price_impact_bps: z.number(),
      })
    ),
    recent_trade_size_p95: z.string(),
    risk_level: z.string(),
  }),
  handler: async ({ input }: any) => {
    try {
      const result = await analyzeSlippage(input);
      return { output: result };
    } catch (err: any) {
      return {
        output: {
          min_safe_slip_bps: 500,
          recommended_slip_bps: 500,
          pool_depths: [],
          recent_trade_size_p95: "0",
          risk_level: "extreme",
          error: err.message ?? "Unknown error",
        },
      };
    }
  },
});

addEntrypoint({
  key: "health",
  description: "Health check endpoint",
  input: z.object({}) as any,
  output: z.object({ status: z.string(), timestamp: z.number() }) as any,
  handler: async () => ({
    output: { status: "ok", timestamp: Date.now() },
  }),
});

export default app;
