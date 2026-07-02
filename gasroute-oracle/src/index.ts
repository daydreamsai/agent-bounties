/**
 * GasRoute Oracle — Agent entrypoint
 *
 * Built with @lucid-dreams/agent-kit v0.2.24.
 * Exposes a single "gas-estimate" entrypoint that returns the cheapest
 * chain and fee estimate for a given set of chains, calldata size, and
 * gas units.
 *
 * Deploy on any Bun/Node HTTP runtime (Vercel, Railway, Fly, etc.).
 *
 * To run locally:
 *   export PORT=3000 && bun run src/index.ts
 *
 * The export default app is auto-served by Bun when the file is the entrypoint.
 */

import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { estimateGasRoute } from "./gas-oracle";
import { validateChains, SUPPORTED_CHAINS } from "./chains";

// ── Create the agent app ─────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp(
  {
    name: "gasroute-oracle",
    version: "0.1.0",
    description:
      "GasRoute Oracle — finds the cheapest chain and timing hint for a given gas load across multiple EVM networks.",
  },
  {
    // Payments disabled for now — enable by providing PAY_TO + FACILITATOR_URL
    payments: false,
  }
);

// ── Entrypoint: gas-estimate ─────────────────────────────────────

addEntrypoint({
  key: "gas-estimate",
  description:
    "Given a set of chain names, calldata size, and estimated gas units, returns the recommended chain, estimated fee in native token and USD, network congestion level, and a priority tip hint.",

  input: z
    .object({
      chain_set: z
        .array(z.string())
        .min(1, "At least one chain is required")
        .describe(
          `Array of EVM chain names to compare. Supported: ${SUPPORTED_CHAINS.join(", ")}`
        ),
      calldata_size_bytes: z
        .number()
        .positive("Calldata size must be positive")
        .describe(
          "Size of the calldata in bytes (for potential calldata-based fee adjustments)"
        ),
      gas_units_est: z
        .number()
        .positive("Estimated gas units must be positive")
        .describe(
          "Estimated gas units for the transaction (e.g. 21000 for a simple ETH transfer)"
        ),
    })
    .describe("Input parameters for gas estimation"),

  output: z
    .object({
      chain: z.string().describe("Recommended chain with the lowest estimated cost"),
      fee_native: z
        .string()
        .describe("Estimated fee in the chain's native token (e.g. '0.0005')"),
      fee_usd: z
        .string()
        .describe("Estimated fee in US dollars (e.g. '0.42')"),
      busy_level: z
        .enum(["low", "medium", "high", "congested"])
        .describe("Current network congestion level based on base fee"),
      tip_hint: z
        .string()
        .describe("Suggested priority fee in gwei (e.g. '0.01')"),
    })
    .describe("Gas estimation result"),

  async handler({ input }) {
    const { chain_set, gas_units_est } = input;

    // Validate chains
    validateChains(chain_set);

    // Fetch estimates from real RPC data and choose cheapest
    const result = await estimateGasRoute(
      chain_set,
      input.calldata_size_bytes,
      gas_units_est
    );

    return {
      output: result,
      usage: {
        total_tokens: chain_set.length * 85 + 120,
      },
    };
  },
});

// ── Export Hono app for the runtime ─────────────────────────────

export default app;
