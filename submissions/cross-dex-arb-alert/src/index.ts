import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { detectArbitrage } from "./logic.js";

if (!process.env.ADDRESS) {
  throw new Error(
    "ADDRESS environment variable is required. Refusing to start with the zero address to prevent burning payments."
  );
}

const { app, addEntrypoint } = createAgentApp(
  {
    name: "cross-dex-arb-alert",
    version: "1.0.0",
    description: "Flag price spreads across DEXs after fees and gas to spot profitable swaps",
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
  key: "scan",
  description: "Detect cross-DEX token price spreads that exceed a minimum threshold after accounting for fees and gas",
  input: z.object({
    token_in: z.string().describe("Input token address or symbol (e.g. 'WETH', '0x...')"),
    token_out: z.string().describe("Output token address or symbol (e.g. 'USDC', '0x...')"),
    amount_in: z.string().describe("Amount of input token in human units (e.g. '1' for 1 WETH)"),
    chains: z.array(z.string()).optional().default(["ethereum"]).describe("Chains to scan for arbitrage opportunities"),
    min_spread_bps: z.number().optional().default(10).describe("Minimum net spread in basis points to report. Default: 10"),
  }) as any,
  output: z.object({
    opportunities: z.array(z.object({
      buy_dex: z.string(),
      sell_dex: z.string(),
      buy_price: z.string(),
      sell_price: z.string(),
      gross_spread_bps: z.number(),
      net_spread_bps: z.number(),
      est_profit_usd: z.string(),
      est_gas_cost_usd: z.string(),
      chain: z.string(),
    })),
    best_route: z.object({
      buy_dex: z.string(),
      sell_dex: z.string(),
      net_spread_bps: z.number(),
      est_profit_usd: z.string(),
    }).nullable(),
    token_in: z.string(),
    token_out: z.string(),
    amount_in: z.string(),
    dexes_queried: z.number(),
    queried_at: z.string(),
  }) as any,
  async handler({ input }: any) {
    const result = await detectArbitrage({
      token_in: input.token_in,
      token_out: input.token_out,
      amount_in: input.amount_in,
      chains: input.chains ?? ["ethereum"],
      min_spread_bps: input.min_spread_bps ?? 10,
    });
    return {
      output: result,
      usage: { total_tokens: result.opportunities.length },
    };
  },
});

addEntrypoint({
  key: "health",
  description: "Liveness check and supported DEX listing",
  async handler() {
    return {
      output: {
        status: "ok",
        supported_chains: ["ethereum", "base", "arbitrum", "polygon", "optimism"],
        supported_dexes: ["Uniswap V2", "Uniswap V3", "SushiSwap", "Curve", "1inch"],
        data_sources: ["1inch Spot Price API", "DexScreener", "on-chain quotes"],
      },
    };
  },
});

export default app;
