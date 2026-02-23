import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { estimateGasRoutes } from "./logic.js";

// Note: The agent-kit SDK's .d.ts files reference an internal zod build whose
// ZodObject type is structurally incompatible with the project-level zod.
// The runtime behaviour is fully correct; the `as any` casts silence the
// type-checker for the SDK boundary only.

const { app, addEntrypoint } = createAgentApp(
  {
    name: "gas-oracle",
    version: "1.0.0",
    description: "Find cheapest gas route for cross-chain operations",
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
  key: "estimate",
  description:
    "Estimate gas costs across chains and recommend cheapest route",
  input: z.object({
    chain_set: z
      .array(z.string())
      .describe(
        "Chains to compare, e.g. ['ethereum', 'base', 'arbitrum', 'optimism']"
      ),
    calldata_size_bytes: z
      .number()
      .int()
      .nonnegative()
      .describe("Size of transaction calldata in bytes"),
    gas_units_est: z
      .number()
      .int()
      .positive()
      .describe("Estimated gas units for the transaction"),
  }) as any,
  output: z.object({
    chain: z.string(),
    fee_native: z.string(),
    fee_usd: z.string(),
    busy_level: z.string(),
    tip_hint: z.string(),
    all_chains: z.array(
      z.object({
        chain: z.string(),
        fee_native: z.string(),
        fee_usd: z.string(),
        busy_level: z.string(),
        tip_hint: z.string(),
        gas_price_gwei: z.string(),
        base_fee_gwei: z.string(),
        l1_data_fee: z.string().optional(),
      })
    ),
  }) as any,
  handler: async ({ input }: any) => {
    try {
      const result = await estimateGasRoutes(input);
      return { output: result };
    } catch (err: any) {
      return {
        output: {
          chain: "none",
          fee_native: "0",
          fee_usd: "0",
          busy_level: "unknown",
          tip_hint: "0",
          all_chains: [],
          error: err.message ?? "Unknown error",
        },
      };
    }
  },
});

addEntrypoint({
  key: "health",
  description: "Health check",
  input: z.object({}) as any,
  output: z.object({ status: z.string(), timestamp: z.number() }) as any,
  handler: async () => ({
    output: { status: "ok", timestamp: Date.now() },
  }),
});

export default app;
