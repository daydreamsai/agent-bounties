import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { scanNewPairs } from "./logic.js";

const { app, addEntrypoint } = createAgentApp(
  {
    name: "fresh-markets-watch",
    version: "1.0.0",
    description: "List new AMM pairs or pools in the last few minutes for discovery bots or yield scouts",
  },
  {
    payments: {
      payTo:
        (process.env.ADDRESS as `0x${string}`) ||
        "0x0000000000000000000000000000000000000000",
      network: (process.env.NETWORK as any) || "base-sepolia",
      defaultPrice: process.env.DEFAULT_PRICE || "1000",
    } as any,
  }
);

addEntrypoint({
  key: "scan",
  description: "Scan for new AMM pairs/pools created within a time window across specified chains and DEX factories",
  input: z.object({
    chain: z.string().optional().default("base").describe("Target blockchain (ethereum, base, arbitrum, polygon)"),
    factories: z.array(z.string()).optional().describe("AMM factory contract addresses to monitor. Defaults to major Uniswap V2/V3 factories."),
    window_minutes: z.number().optional().default(30).describe("Time window in minutes to scan for new pairs. Default: 30"),
  }) as any,
  output: z.object({
    pairs: z.array(z.object({
      pair_address: z.string(),
      tokens: z.array(z.object({
        address: z.string(),
        symbol: z.string(),
        name: z.string(),
      })),
      init_liquidity: z.string(),
      init_liquidity_usd: z.string(),
      dex: z.string(),
      created_at: z.string(),
      block_number: z.number(),
    })),
    chain: z.string(),
    window_minutes: z.number(),
    scanned_factories: z.number(),
    queried_at: z.string(),
  }) as any,
  async handler({ input }: any) {
    const result = await scanNewPairs({
      chain: input.chain ?? "base",
      factories: input.factories,
      window_minutes: input.window_minutes ?? 30,
    });
    return {
      output: result,
      usage: { total_tokens: result.pairs.length },
    };
  },
});

addEntrypoint({
  key: "health",
  description: "Liveness check and supported chain listing",
  async handler() {
    return {
      output: {
        status: "ok",
        supported_chains: ["ethereum", "base", "arbitrum", "polygon", "optimism", "bsc"],
        default_factories: ["Uniswap V2", "Uniswap V3", "SushiSwap", "PancakeSwap"],
        data_sources: ["on-chain event logs", "DexScreener API"],
      },
    };
  },
});

export default app;
