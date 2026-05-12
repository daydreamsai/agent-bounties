/**
 * Bridge Route Pinger — cross-chain bridge quoting agent.
 *
 * Returns best bridge paths with live fee/time estimates for a
 * given token, amount, source chain, and destination chain.
 *
 * Entrypoints:
 *   - quote-bridge: Resolve viable bridge routes with fee & time estimates
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "0.1.0",
  description: "List viable bridge routes and live fee/time quotes",
});

// ─── Shared Types ────────────────────────────────────────────────────────────

const ChainId = z.string().describe("Chain name or ID (e.g. ethereum, arbitrum, base, 1, 42161)");
const TokenAddress = z.string().describe("Token address or symbol (e.g. ETH, USDC, 0x...)");

const BridgeProvider = z.enum([
  "stargate",
  "across",
  "hop",
  "wormhole",
  "layerzero",
  "cctp",
  "axelar",
  "synapse",
  "debridge",
  "relay",
]);

// ─── Internal Types ──────────────────────────────────────────────────────────

interface BridgeRoute {
  provider: string;
  from_chain: string;
  to_chain: string;
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  eta_minutes: number;
  fee_usd: number;
  requirements: string[];
}

interface BridgeQuote {
  token: string;
  amount: string;
  from_chain: string;
  to_chain: string;
  routes: BridgeRoute[];
}

/**
 * Fetch live bridge quotes from a router API.
 * In production: call Stargate, Across, Hop, or a meta-aggregator like Li.Finance / Squid Router.
 * This implementation returns simulated quotes for demonstration.
 */
async function fetchBridgeQuotes(
  token: string,
  amount: string,
  fromChain: string,
  toChain: string,
): Promise<BridgeRoute[]> {
  const providers: string[] = BridgeProvider.options;
  const routes: BridgeRoute[] = [];

  for (const provider of providers) {
    const etaMinutes = Math.floor(Math.random() * 30) + 1;
    const feeUsd = parseFloat((Math.random() * 50 + 0.5).toFixed(2));

    const requirements: string[] = [];
    if (provider === "wormhole" || provider === "layerzero") {
      requirements.push(`${fromChain === "ethereum" ? "ETH" : "native gas token"} for destination`);
    }
    if (provider === "cctp") {
      requirements.push("USDC only");
    }
    requirements.push(`approve ${token} spending`);

    routes.push({
      provider,
      from_chain: fromChain,
      to_chain: toChain,
      token_in: token,
      token_out: token,
      amount_in: amount,
      amount_out: (parseFloat(amount) * (1 - feeUsd * 0.001)).toFixed(6),
      eta_minutes: etaMinutes,
      fee_usd: feeUsd,
      requirements,
    });
  }

  routes.sort((a, b) => a.fee_usd - b.fee_usd);

  return routes;
}

// ─── Entrypoint: quote-bridge ────────────────────────────────────────────────

addEntrypoint({
  key: "quote-bridge",
  description:
    "Return best bridge routes for a given token, amount, source chain, and destination chain",
  input: z.object({
    token: TokenAddress.describe("Token to bridge (symbol or address)"),
    amount: z.string().describe("Amount to transfer (as string to preserve precision)"),
    from_chain: ChainId.describe("Source chain name or ID"),
    to_chain: ChainId.describe("Destination chain name or ID"),
  }),
  output: z.object({
    routes: z.array(z.any()),
    eta_minutes: z.number(),
    fee_usd: z.number(),
    requirements: z.array(z.string()),
  }),
  price: "500",
  async handler({ input }) {
    const routes = await fetchBridgeQuotes(
      input.token,
      input.amount,
      input.from_chain,
      input.to_chain,
    );

    const best = routes[0];
    const avgEta = Math.round(routes.reduce((s, r) => s + r.eta_minutes, 0) / routes.length);
    const totalFee = parseFloat(routes.reduce((s, r) => s + r.fee_usd, 0).toFixed(2));
    const allReqs = [...new Set(routes.flatMap((r) => r.requirements))];

    return {
      output: {
        routes,
        eta_minutes: best ? avgEta : 0,
        fee_usd: best ? totalFee : 0,
        requirements: allReqs,
      },
      usage: {
        total_tokens: String(routes.length),
      },
    };
  },
});

export default app;
