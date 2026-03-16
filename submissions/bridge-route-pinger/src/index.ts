/**
 * Bridge Route Pinger Agent
 *
 * Lists viable bridge routes with live fee/time quotes using Li.Fi API.
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/10
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// Chain ID mappings
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  eth: 1,
  polygon: 137,
  matic: 137,
  arbitrum: 42161,
  arb: 42161,
  optimism: 10,
  op: 10,
  base: 8453,
  avalanche: 43114,
  avax: 43114,
  bsc: 56,
  bnb: 56,
  solana: 1151111081099592,
};

// Common token addresses per chain
const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  "1": {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    ETH: "0x0000000000000000000000000000000000000000",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  "137": {
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    MATIC: "0x0000000000000000000000000000000000000000",
    WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  },
  "42161": {
    USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    ETH: "0x0000000000000000000000000000000000000000",
    ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
  },
};

interface BridgeRoute {
  bridge: string;
  tool: string;
  from_chain: string;
  to_chain: string;
  token: string;
  amount_in: number;
  amount_out: number;
  fee_usd: number;
  eta_minutes: number;
  gas_cost_usd: number;
  total_cost_usd: number;
  requirements: string[];
}

async function fetchLiFiRoutes(
  token: string,
  amount: string,
  fromChain: string,
  toChain: string
): Promise<BridgeRoute[]> {
  const fromChainId = CHAIN_IDS[fromChain.toLowerCase()] || parseInt(fromChain);
  const toChainId = CHAIN_IDS[toChain.toLowerCase()] || parseInt(toChain);

  if (!fromChainId || !toChainId) {
    throw new Error(`Unknown chain: ${fromChain} or ${toChain}`);
  }

  // Get token address
  const fromTokens = TOKEN_ADDRESSES[String(fromChainId)] || {};
  const toTokens = TOKEN_ADDRESSES[String(toChainId)] || {};
  const tokenUpper = token.toUpperCase();

  const fromToken = fromTokens[tokenUpper] || "0x0000000000000000000000000000000000000000";
  const toToken = toTokens[tokenUpper] || fromToken;

  // Convert amount to wei (assuming USDC = 6 decimals, ETH = 18)
  const decimals = ["USDC", "USDT"].includes(tokenUpper) ? 6 : 18;
  const amountWei = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals)).toString();

  const url = `https://li.quest/v1/routes?fromChainId=${fromChainId}&toChainId=${toChainId}&fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&fromAmount=${amountWei}&options[slippage]=0.03`;

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LiFi API error: ${res.status} - ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const routes: BridgeRoute[] = [];

  for (const route of (data.routes || []).slice(0, 5)) {
    const step = route.steps?.[0];
    if (!step) continue;

    const toolDetails = step.toolDetails || {};
    const feeCosts = route.gasCostUSD ? parseFloat(route.gasCostUSD) : 0;
    const amountOut = parseFloat(route.toAmountUSD || "0");
    const amountIn = parseFloat(route.fromAmountUSD || amount);
    const feeUsd = amountIn - amountOut;

    const etaSeconds = route.steps.reduce((sum: number, s: { estimate?: { executionDuration?: number } }) => sum + (s.estimate?.executionDuration || 300), 0);

    routes.push({
      bridge: toolDetails.name || step.tool || "unknown",
      tool: step.tool || "unknown",
      from_chain: fromChain,
      to_chain: toChain,
      token: tokenUpper,
      amount_in: amountIn,
      amount_out: amountOut,
      fee_usd: Math.max(0, feeUsd),
      eta_minutes: Math.round(etaSeconds / 60),
      gas_cost_usd: feeCosts,
      total_cost_usd: Math.max(0, feeUsd) + feeCosts,
      requirements: step.estimate?.approvalAddress ? [`Approve ${token} for ${step.estimate.approvalAddress}`] : [],
    });
  }

  return routes;
}

// ─── Agent App ────────────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "1.0.0",
  description: "List viable bridge routes with live fee/time quotes for token transfers across chains.",
});

addEntrypoint({
  key: "get_routes",
  description: "Return best bridge paths for a given token and chains with fee/time estimates.",
  input: z.object({
    token: z.string().describe("Token symbol (USDC, ETH, USDT, etc.)"),
    amount: z.string().describe("Amount to bridge (e.g. '1000')"),
    from_chain: z.string().describe("Source chain (ethereum, polygon, arbitrum, optimism, base, etc.)"),
    to_chain: z.string().describe("Destination chain"),
  }),
  async handler({ input }) {
    const routes = await fetchLiFiRoutes(input.token, input.amount, input.from_chain, input.to_chain);

    const best = routes.length > 0
      ? routes.reduce((a, b) => a.total_cost_usd < b.total_cost_usd ? a : b)
      : null;

    return {
      output: {
        routes,
        best_route: best,
        token: input.token.toUpperCase(),
        amount: input.amount,
        from_chain: input.from_chain,
        to_chain: input.to_chain,
        route_count: routes.length,
        fetched_at: new Date().toISOString(),
      },
      usage: { total_tokens: String(routes.length) },
    };
  },
});

addEntrypoint({
  key: "echo",
  description: "Health check",
  input: z.object({ text: z.string().optional() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "bridge-route-pinger online") },
      usage: { total_tokens: "0" },
    };
  },
});

const PORT = parseInt(process.env.PORT ?? "8082");
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Bridge Route Pinger agent running on http://0.0.0.0:${info.port}`);
});

export default app;
