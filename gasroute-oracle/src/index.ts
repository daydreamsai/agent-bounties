/**
 * GasRoute Oracle — Multi-chain gas estimation agent.
 *
 * Finds the cheapest chain and timing for a transaction across
 * Ethereum, Polygon, Arbitrum, Optimism, and Base.
 *
 * Built with @lucid-dreams/agent-kit for x402 monetization.
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { findCheapestChain, estimateChainFee } from "./gas-fetcher.js";
import { DEFAULT_CHAIN_SET, SUPPORTED_CHAINS } from "./chains.js";

const hasPayments = !!(process.env.ADDRESS && process.env.ADDRESS.startsWith("0x"));

const { app, addEntrypoint } = createAgentApp(
  {
    name: "gasroute-oracle",
    version: "0.1.0",
    description:
      "Multi-chain gas estimation oracle. Returns the cheapest chain and timing hint for a swap or contract call across Ethereum, Polygon, Arbitrum, Optimism, and Base.",
  },
  hasPayments
    ? {
        config: {
          payments: {
            facilitatorUrl: process.env.FACILITATOR_URL as `https://${string}`,
            payTo: process.env.ADDRESS as `0x${string}`,
            network: (process.env.NETWORK ?? "base-sepolia") as any,
            defaultPrice: process.env.DEFAULT_PRICE ?? "100",
          },
        },
        useConfigPayments: true,
      }
    : { payments: false }
);

// ─── Main entrypoint: find cheapest chain ───────────────────────────────────

addEntrypoint({
  key: "gasroute",
  description:
    "Find the cheapest chain and timing for a transaction. Returns recommended chain, fee in native token and USD, network congestion level, and priority fee hint.",
  input: z.object({
    chain_set: z
      .array(z.string())
      .optional()
      .describe(
        "Set of chains to consider. Supported: ethereum, polygon, arbitrum, optimism, base. Defaults to all."
      ),
    calldata_size_bytes: z
      .number()
      .int()
      .min(0)
      .describe("Size of transaction calldata in bytes"),
    gas_units_est: z
      .number()
      .int()
      .positive()
      .describe("Estimated gas units needed for the transaction"),
  }),
  output: z.object({
    chain: z.string(),
    fee_native: z.string(),
    fee_usd: z.string(),
    busy_level: z.enum(["low", "medium", "high", "very_high"]),
    tip_hint: z.string(),
    all_estimates: z
      .array(
        z.object({
          chain: z.string(),
          fee_native: z.string(),
          fee_usd: z.string(),
          busy_level: z.enum(["low", "medium", "high", "very_high"]),
          tip_hint: z.string(),
          gas_price_gwei: z.string(),
          base_fee_gwei: z.string(),
          priority_fee_gwei: z.string(),
        })
      )
      .describe("All chain estimates sorted by cost (cheapest first)"),
  }),
  async handler({ input }) {
    const chainSet = input.chain_set ?? DEFAULT_CHAIN_SET;
    const { recommendation, all_estimates } = await findCheapestChain(
      chainSet,
      input.calldata_size_bytes,
      input.gas_units_est
    );

    return {
      output: {
        chain: recommendation.chain,
        fee_native: recommendation.fee_native,
        fee_usd: recommendation.fee_usd,
        busy_level: recommendation.busy_level,
        tip_hint: recommendation.tip_hint,
        all_estimates,
      },
      usage: {
        total_tokens: chainSet.length,
      },
    };
  },
});

// ─── Single chain estimate ──────────────────────────────────────────────────

addEntrypoint({
  key: "estimate",
  description:
    "Get gas fee estimate for a specific chain. Useful when you already know which chain to use.",
  input: z.object({
    chain: z
      .string()
      .describe(
        "Chain ID: ethereum, polygon, arbitrum, optimism, or base"
      ),
    calldata_size_bytes: z
      .number()
      .int()
      .min(0)
      .describe("Size of transaction calldata in bytes"),
    gas_units_est: z
      .number()
      .int()
      .positive()
      .describe("Estimated gas units needed"),
  }),
  output: z.object({
    chain: z.string(),
    fee_native: z.string(),
    fee_usd: z.string(),
    busy_level: z.enum(["low", "medium", "high", "very_high"]),
    tip_hint: z.string(),
    gas_price_gwei: z.string(),
    base_fee_gwei: z.string(),
    priority_fee_gwei: z.string(),
  }),
  async handler({ input }) {
    const estimate = await estimateChainFee(
      input.chain,
      input.calldata_size_bytes,
      input.gas_units_est
    );

    if (!estimate) {
      throw new Error(
        `Unsupported or unreachable chain: ${input.chain}. Supported: ${Object.keys(SUPPORTED_CHAINS).join(", ")}`
      );
    }

    return {
      output: estimate,
      usage: { total_tokens: 1 },
    };
  },
});

// ─── Supported chains list ──────────────────────────────────────────────────

addEntrypoint({
  key: "chains",
  description: "List all supported chains and their metadata.",
  input: z.object({}),
  async handler() {
    const chains = Object.values(SUPPORTED_CHAINS).map((c) => ({
      id: c.id,
      name: c.name,
      chainId: c.chainId,
      nativeToken: c.nativeToken,
      eip1559: c.eip1559,
      blockTimeSeconds: c.blockTimeSeconds,
    }));

    return {
      output: { chains },
      usage: { total_tokens: 0 },
    };
  },
});

// ─── Serve ──────────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? "3000", 10);

// Node.js: use @hono/node-server
import { serve } from "@hono/node-server";

serve({ fetch: app.fetch as any, port }, () => {
  console.log(`🔥 GasRoute Oracle running on http://localhost:${port}`);
});

export default app;
