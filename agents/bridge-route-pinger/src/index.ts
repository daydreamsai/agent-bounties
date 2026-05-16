/**
 * Bridge Route Pinger — main agent entrypoint.
 *
 * Cross-chain bridge monitoring agent that aggregates route quotes
 * from Stargate V2, Across, Hop Protocol, and more.
 *
 * Bounty: daydreamsai/agent-bounties#10
 * Built with @lucid-dreams/agent-kit for x402 micropayment compatibility.
 */

import { z } from "zod";
import { Hono } from "hono";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { aggregateRoutes, providerHealthCheck, listProviders } from "./providers";
import { normalizeChain, SUPPORTED_CHAINS } from "./types";

const { app: _app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "1.0.0",
  description:
    "Cross-chain bridge route aggregator and monitor. Queries Stargate V2, Across, Hop, and other bridge providers to find optimal routes with real-time fee, time, and liquidity estimates. x402-compatible for micropayment access.",
});
const app: Hono = _app;

// ── Entrypoint: bridge-routes ──────────────────────────────────────────────
addEntrypoint({
  key: "bridge-routes",
  description:
    "Find all available bridge routes for a token transfer between two chains, sorted by fee and speed.",
  input: z.object({
    token: z.string().default("USDC").describe("Token symbol (e.g., USDC, ETH, USDT)"),
    amount: z
      .number()
      .positive()
      .default(1000)
      .describe("Amount to transfer in token units"),
    from_chain: z
      .string()
      .describe("Source chain: ETH, ARB, BASE, OP, POLYGON, AVAX, BSC, SOL"),
    to_chain: z
      .string()
      .describe("Destination chain: ETH, ARB, BASE, OP, POLYGON, AVAX, BSC, SOL"),
  }),
  async handler({ input }) {
    const fromChain = normalizeChain(input.from_chain);
    const toChain = normalizeChain(input.to_chain);

    const result = await aggregateRoutes({
      token: input.token,
      amount: input.amount,
      fromChain,
      toChain,
    });

    return {
      output: result,
      usage: { total_tokens: JSON.stringify(input).length },
    };
  },
});

// ── Entrypoint: route-compare ──────────────────────────────────────────────
addEntrypoint({
  key: "route-compare",
  description:
    "Compare bridge routes side-by-side: see which provider is fastest, cheapest, and most liquid for a given route.",
  input: z.object({
    token: z.string().default("USDC"),
    amount: z.number().positive().default(1000),
    from_chain: z.string(),
    to_chain: z.string(),
  }),
  async handler({ input }) {
    const fromChain = normalizeChain(input.from_chain);
    const toChain = normalizeChain(input.to_chain);

    const result = await aggregateRoutes({
      token: input.token,
      amount: input.amount,
      fromChain,
      toChain,
    });

    // Build comparison table
    const comparison = result.allRoutes
      .sort((a, b) => a.feeUsd - b.feeUsd)
      .map((r, i) => ({
        rank: i + 1,
        provider: r.provider,
        type: r.type,
        fee_usd: r.feeUsd,
        time_min: r.estimatedTimeMin,
        output_amount: r.outputAmount,
        risk: r.riskLevel,
        liquidity_available: r.liquidityUsd
          ? `$${(r.liquidityUsd / 1e6).toFixed(1)}M`
          : "N/A",
      }));

    return {
      output: {
        query: result.query,
        comparison,
        total_providers: result.providersQueried.length,
        providers: result.providersQueried,
        recommendation: result.recommendation,
      },
      usage: { total_tokens: JSON.stringify(input).length },
    };
  },
});

// ── Entrypoint: provider-health ────────────────────────────────────────────
addEntrypoint({
  key: "provider-health",
  description:
    "Check the health of all bridge providers. Returns which providers are online and responding.",
  input: z.object({}),
  async handler() {
    const health = await providerHealthCheck();
    const allProviders = listProviders();

    return {
      output: {
        status: health.unhealthy.length === 0 ? "ALL_HEALTHY" : "DEGRADED",
        healthy: health.healthy,
        unhealthy: health.unhealthy,
        total_providers: allProviders.length,
        providers: allProviders.map((p) => ({
          name: p.name,
          status: health.healthy.includes(p.name) ? "online" : "offline",
        })),
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: 0 },
    };
  },
});

// ── Entrypoint: supported-chains ───────────────────────────────────────────
addEntrypoint({
  key: "supported-chains",
  description:
    "List all supported chains and the bridge providers available for each chain pair.",
  input: z.object({}),
  async handler() {
    const chainNames = Object.keys(SUPPORTED_CHAINS);
    const providers = listProviders().map((p) => ({
      name: p.name,
    }));

    return {
      output: {
        chains: chainNames.map((c) => ({
          id: c,
          name: SUPPORTED_CHAINS[c]!.name,
          chainId: SUPPORTED_CHAINS[c]!.chainId,
        })),
        providers,
        total_chains: chainNames.length,
        total_providers: providers.length,
      },
      usage: { total_tokens: 0 },
    };
  },
});

export default app;
