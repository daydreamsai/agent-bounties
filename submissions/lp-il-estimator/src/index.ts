import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { estimateIL } from "./logic.js";

if (!process.env.ADDRESS) {
  throw new Error(
    "ADDRESS environment variable is required. Refusing to start with the zero address to prevent burning payments."
  );
}

const { app, addEntrypoint } = createAgentApp(
  {
    name: "lp-il-estimator",
    version: "1.0.0",
    description:
      "Calculate impermanent loss and fee APR for any LP position or simulated deposit",
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
  key: "estimate",
  description:
    "Compute impermanent loss, fee APR, and net position value for an LP position or simulated deposit",
  input: z.object({
    pool_address: z
      .string()
      .optional()
      .describe("LP pool address for direct lookup"),
    token_a: z
      .string()
      .describe("First token symbol or address (e.g. 'ETH', '0x...')"),
    token_b: z
      .string()
      .describe("Second token symbol or address (e.g. 'USDC', '0x...')"),
    deposit_value_usd: z
      .string()
      .optional()
      .default("10000")
      .describe("Total deposit value in USD for simulation. Default: $10,000"),
    window_hours: z
      .number()
      .optional()
      .default(168)
      .describe("Historical window for fee/volume data in hours. Default: 168 (7 days)"),
    chain: z
      .string()
      .optional()
      .default("ethereum")
      .describe("Chain where the pool lives"),
    price_change_pct: z
      .number()
      .optional()
      .describe(
        "Simulate IL for a specific price change percentage (e.g. 50 for +50%)"
      ),
  }) as any,
  output: z.object({
    pool: z.object({
      address: z.string(),
      dex: z.string(),
      chain: z.string(),
      token_a: z.object({ symbol: z.string(), address: z.string() }),
      token_b: z.object({ symbol: z.string(), address: z.string() }),
      fee_tier: z.string(),
    }),
    metrics: z.object({
      il_percent: z.number(),
      il_usd: z.string(),
      fee_apr: z.number(),
      fee_earned_usd: z.string(),
      net_apr: z.number(),
      volume_24h: z.string(),
      tvl: z.string(),
      price_change_pct: z.number(),
    }),
    simulation: z.object({
      deposit_value_usd: z.string(),
      current_lp_value_usd: z.string(),
      hodl_value_usd: z.string(),
      il_vs_hodl_usd: z.string(),
      fees_earned_usd: z.string(),
      net_value_usd: z.string(),
    }),
    notes: z.array(z.string()),
    queried_at: z.string(),
  }) as any,
  async handler({ input }: any) {
    try {
      const result = await estimateIL({
        pool_address: input.pool_address,
        token_a: input.token_a,
        token_b: input.token_b,
        deposit_value_usd: input.deposit_value_usd ?? "10000",
        window_hours: input.window_hours ?? 168,
        chain: input.chain ?? "ethereum",
        price_change_pct: input.price_change_pct,
      });
      return {
        output: result,
        usage: { total_tokens: 1 },
      };
    } catch (err: any) {
      return {
        output: {
          pool: {
            address: input.pool_address ?? "unknown",
            dex: "unknown",
            chain: input.chain ?? "ethereum",
            token_a: { symbol: input.token_a, address: "" },
            token_b: { symbol: input.token_b, address: "" },
            fee_tier: "unknown",
          },
          metrics: {
            il_percent: 0,
            il_usd: "$0",
            fee_apr: 0,
            fee_earned_usd: "$0",
            net_apr: 0,
            volume_24h: "$0",
            tvl: "$0",
            price_change_pct: 0,
          },
          simulation: {
            deposit_value_usd: input.deposit_value_usd ?? "10000",
            current_lp_value_usd: "$0",
            hodl_value_usd: "$0",
            il_vs_hodl_usd: "$0",
            fees_earned_usd: "$0",
            net_value_usd: "$0",
          },
          notes: [`Error: ${err.message ?? "Unknown error"}`],
          queried_at: new Date().toISOString(),
        },
        usage: { total_tokens: 0 },
      };
    }
  },
});

addEntrypoint({
  key: "health",
  description: "Liveness check and supported AMM listing",
  async handler() {
    return {
      output: {
        status: "ok",
        supported_amms: [
          "Uniswap V2",
          "Uniswap V3",
          "SushiSwap",
          "Curve",
          "PancakeSwap",
        ],
        supported_chains: [
          "ethereum",
          "base",
          "arbitrum",
          "polygon",
          "optimism",
        ],
        data_sources: ["DexScreener API", "DeFiLlama"],
      },
    };
  },
});

export default app;
