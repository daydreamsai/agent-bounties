import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { watchPools } from "./logic.js";

if (!process.env.ADDRESS) {
  throw new Error(
    "ADDRESS environment variable is required. Refusing to start with the zero address to prevent burning payments."
  );
}

const { app, addEntrypoint } = createAgentApp(
  {
    name: "yield-pool-watcher",
    version: "1.0.0",
    description: "Track APY and TVL across DeFi pools and alert on sharp changes",
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
  key: "watch",
  description: "Monitor DeFi pool metrics (APY, TVL) across protocols and emit alerts on significant changes",
  input: z.object({
    protocol_ids: z.array(z.string()).optional().default(["aave-v3", "compound-v3"]).describe("DeFi protocols to monitor (DeFiLlama protocol slugs)"),
    pools: z.array(z.object({
      address: z.string().optional().describe("Pool contract address"),
      symbol: z.string().optional().describe("Pool token symbol (e.g. 'USDC', 'ETH')"),
    })).optional().describe("Specific pools to watch. If omitted, returns top pools by TVL."),
    apy_change_threshold: z.number().optional().default(20).describe("Alert when APY changes by more than this percentage points. Default: 20"),
    tvl_change_threshold: z.number().optional().default(15).describe("Alert when TVL changes by more than this %. Default: 15"),
    limit: z.number().optional().default(20).describe("Maximum number of pools to return. Default: 20"),
  }) as any,
  output: z.object({
    pools: z.array(z.object({
      protocol: z.string(),
      chain: z.string(),
      pool_id: z.string(),
      symbol: z.string(),
      tvl_usd: z.string(),
      apy: z.number(),
      apy_base: z.number(),
      apy_reward: z.number(),
      apy_1d_change: z.number(),
      apy_7d_change: z.number(),
      tvl_1d_change_pct: z.number(),
      il_risk: z.string(),
      stablecoin: z.boolean(),
    })),
    alerts: z.array(z.object({
      pool_id: z.string(),
      symbol: z.string(),
      protocol: z.string(),
      type: z.string(),
      message: z.string(),
      severity: z.string(),
    })),
    protocol_count: z.number(),
    total_pools_scanned: z.number(),
    queried_at: z.string(),
  }) as any,
  async handler({ input }: any) {
    const result = await watchPools({
      protocol_ids: input.protocol_ids ?? ["aave-v3", "compound-v3"],
      pools: input.pools,
      apy_change_threshold: input.apy_change_threshold ?? 20,
      tvl_change_threshold: input.tvl_change_threshold ?? 15,
      limit: input.limit ?? 20,
    });
    return {
      output: result,
      usage: { total_tokens: result.pools.length },
    };
  },
});

addEntrypoint({
  key: "health",
  description: "Liveness check and supported protocol listing",
  async handler() {
    return {
      output: {
        status: "ok",
        supported_protocols: ["aave-v3", "compound-v3", "lido", "rocket-pool", "morpho", "yearn", "curve-dex", "convex-finance"],
        data_source: "DeFiLlama Yields API",
        refresh_interval: "10 minutes",
      },
    };
  },
});

export default app;
