import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { findBridgeRoutes } from "./logic.js";

const { app, addEntrypoint } = createAgentApp(
  {
    name: "bridge-route-pinger",
    version: "1.0.0",
    description:
      "Find optimal bridge routes for cross-chain token transfers. Queries live pricing, fees, and ETAs across multiple bridge protocols.",
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

// ---------------------------------------------------------------------------
// find_routes — main entrypoint
// ---------------------------------------------------------------------------

addEntrypoint({
  key: "find_routes",
  description:
    "List viable bridge routes with live fee and time quotes for a cross-chain token transfer",
  input: z.object({
    token: z
      .string()
      .describe(
        'Token to bridge — address (0x...) or symbol like "USDC", "ETH", "USDT", "DAI"'
      ),
    amount: z
      .string()
      .describe(
        'Amount to transfer in human-readable units (e.g. "100" for 100 USDC)'
      ),
    from_chain: z
      .string()
      .describe(
        'Source chain name or ID (e.g. "ethereum", "base", "arbitrum", "optimism")'
      ),
    to_chain: z
      .string()
      .describe("Destination chain name or ID"),
  }),
  output: z.object({
    routes: z.array(
      z.object({
        name: z.string().describe("Bridge protocol display name"),
        protocol: z.string().describe("Bridge protocol key"),
        estimated_output: z
          .string()
          .describe("Estimated tokens received (with symbol)"),
        estimated_output_usd: z
          .string()
          .describe("Estimated output value in USD"),
        eta_minutes: z
          .number()
          .describe("Estimated transfer time in minutes"),
        fee_usd: z.string().describe("Total bridge/protocol fees in USD"),
        fee_breakdown: z.array(
          z.object({
            name: z.string(),
            amount_usd: z.string(),
          })
        ),
        gas_cost_usd: z
          .string()
          .describe("Estimated gas cost in USD on the source chain"),
        gas_token: z
          .string()
          .describe("Token symbol needed for gas on the source chain"),
      })
    ),
    from_chain: z.string(),
    to_chain: z.string(),
    token: z.string(),
    amount: z.string(),
    requirements: z
      .array(z.string())
      .describe("Additional requirements (gas tokens needed, approvals, etc.)"),
    queried_at: z.string().describe("ISO-8601 timestamp of query"),
  }) as any,
  async handler(ctx) {
    const input = ctx.input as {
      token: string;
      amount: string;
      from_chain: string;
      to_chain: string;
    };

    try {
      const result = await findBridgeRoutes(input);
      return {
        output: result,
        usage: { total_tokens: result.routes.length },
      };
    } catch (err: any) {
      return {
        output: {
          routes: [],
          from_chain: input.from_chain,
          to_chain: input.to_chain,
          token: input.token,
          amount: input.amount,
          requirements: [`Error: ${err.message ?? "Unknown error"}`],
          queried_at: new Date().toISOString(),
        },
        usage: { total_tokens: 0 },
      };
    }
  },
});

// ---------------------------------------------------------------------------
// health — lightweight liveness check
// ---------------------------------------------------------------------------

addEntrypoint({
  key: "health",
  description: "Liveness check returning agent status and supported chains",
  async handler() {
    return {
      output: {
        status: "ok",
        supported_chains: [
          "ethereum",
          "base",
          "arbitrum",
          "optimism",
          "polygon",
          "avalanche",
          "bsc",
          "gnosis",
          "zksync",
          "linea",
          "scroll",
        ],
        supported_tokens: ["USDC", "USDT", "DAI", "ETH", "WETH", "USDC.e"],
        data_source: "li.fi",
      },
    };
  },
});

export default app;
