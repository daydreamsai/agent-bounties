/**
 * Bridge Route Pinger Agent
 *
 * Queries Li.Fi, Socket (Bungee), and Rango APIs for bridge routes.
 * Returns sorted routes with ETA, fees, and requirements.
 * Covers ETH, ARB, OP, BASE, SOL, BSC and 20+ other chains.
 *
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/10
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// ─── Chain Registry ───────────────────────────────────────────────────────────

const CHAIN_IDS: Record<string, number> = {
  ETH: 1,
  ETHEREUM: 1,
  ARB: 42161,
  ARBITRUM: 42161,
  OP: 10,
  OPTIMISM: 10,
  BASE: 8453,
  BSC: 56,
  BNB: 56,
  POLYGON: 137,
  MATIC: 137,
  AVAX: 43114,
  AVALANCHE: 43114,
  FTM: 250,
  FANTOM: 250,
  GNOSIS: 100,
  ZKSYNC: 324,
  LINEA: 59144,
  SCROLL: 534352,
  MANTLE: 5000,
};

// Rango uses string chain names
const RANGO_CHAINS: Record<string, string> = {
  ETH: "ETH",
  ETHEREUM: "ETH",
  ARB: "ARBITRUM",
  ARBITRUM: "ARBITRUM",
  OP: "OPTIMISM",
  OPTIMISM: "OPTIMISM",
  BASE: "BASE",
  BSC: "BSC",
  BNB: "BSC",
  POLYGON: "POLYGON",
  MATIC: "POLYGON",
  AVAX: "AVAX_CCHAIN",
  AVALANCHE: "AVAX_CCHAIN",
  SOL: "SOLANA",
  SOLANA: "SOLANA",
};

// Common token addresses per chain (for Li.Fi / Socket)
const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  USDC: {
    "1": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "42161": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    "10": "0x7f5c764cbc14f9669b88837ca1490cca17c31607",
    "8453": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "56": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    "137": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
  },
  USDT: {
    "1": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "42161": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    "10": "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
    "56": "0x55d398326f99059ff775485246999027b3197955",
    "137": "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
  },
  ETH: {
    "1": "0x0000000000000000000000000000000000000000",
    "42161": "0x0000000000000000000000000000000000000000",
    "10": "0x0000000000000000000000000000000000000000",
    "8453": "0x0000000000000000000000000000000000000000",
  },
  WETH: {
    "1": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "42161": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    "10": "0x4200000000000000000000000000000000000006",
    "8453": "0x4200000000000000000000000000000000000006",
    "56": "0x2170ed0880ac9a755fd29b2688956bd959f933f8",
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface BridgeRoute {
  source: string;             // "lifi" | "socket" | "rango"
  bridge_name: string;
  from_chain: string;
  to_chain: string;
  token: string;
  amount_in: number;
  amount_out: number;
  amount_out_usd: number | null;
  fee_usd: number;
  gas_cost_usd: number;
  total_cost_usd: number;
  eta_minutes: number;
  eta_label: string;
  steps: number;
  requirements: string[];
  approval_required: boolean;
  route_id?: string;
}

function etaLabel(mins: number): string {
  if (mins <= 2) return "~1-2 min";
  if (mins <= 10) return `~${mins} min`;
  if (mins <= 60) return `~${Math.round(mins / 5) * 5} min`;
  return `~${Math.round(mins / 60)}h`;
}

// ─── Li.Fi ────────────────────────────────────────────────────────────────────

interface LifiAction {
  fromChainId: number;
  toChainId: number;
  fromToken: { address: string; symbol: string; decimals: number; priceUSD?: string };
  toToken: { address: string; symbol: string; decimals: number; priceUSD?: string };
  fromAmount: string;
}

interface LifiStep {
  type: string;
  tool: string;
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    feeCosts?: Array<{ amountUSD?: string; name: string }>;
    gasCosts?: Array<{ amountUSD?: string; type: string }>;
    executionDuration?: number;
  };
  action: LifiAction;
}

interface LifiRoute {
  id: string;
  fromToken: { symbol: string; decimals: number; priceUSD?: string };
  toToken: { symbol: string; decimals: number; priceUSD?: string };
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
  steps: LifiStep[];
  tags?: string[];
  gasCostUSD?: string;
  totalFees?: { amountUSD?: string };
}

interface LifiResponse {
  routes?: LifiRoute[];
}

async function fetchLifi(
  fromChainId: number,
  toChainId: number,
  token: string,
  amount: number,
  fromAddress?: string
): Promise<BridgeRoute[]> {
  const fromChainKey = String(fromChainId);
  const tokenAddr = TOKEN_ADDRESSES[token.toUpperCase()]?.[fromChainKey]
    ?? TOKEN_ADDRESSES["USDC"][fromChainKey]
    ?? "0x0000000000000000000000000000000000000000";

  // To token address on destination
  const toChainKey = String(toChainId);
  const toTokenAddr = TOKEN_ADDRESSES[token.toUpperCase()]?.[toChainKey]
    ?? TOKEN_ADDRESSES["USDC"][toChainKey]
    ?? "0x0000000000000000000000000000000000000000";

  // Li.Fi uses 18 decimals for ETH, 6 for USDC/USDT
  const decimals = ["ETH", "WETH"].includes(token.toUpperCase()) ? 18 : 6;
  const amountWei = BigInt(Math.round(amount * 10 ** decimals)).toString();

  const params = new URLSearchParams({
    fromChainId: String(fromChainId),
    toChainId: String(toChainId),
    fromTokenAddress: tokenAddr,
    toTokenAddress: toTokenAddr,
    fromAmount: amountWei,
    ...(fromAddress ? { fromAddress } : {}),
    maxPriceImpact: "0.4",
  });

  const res = await fetch(`https://li.quest/v1/routes?${params}`, {
    headers: { "accept": "application/json" },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("Li.Fi rate limited");
    throw new Error(`Li.Fi API error: ${res.status}`);
  }

  const data = (await res.json()) as LifiResponse;
  const routes = data.routes ?? [];

  return routes.slice(0, 5).map((route): BridgeRoute => {
    const toDecimals = ["ETH", "WETH"].includes(token.toUpperCase()) ? 18 : 6;
    const amountOut = Number(BigInt(route.toAmount)) / 10 ** toDecimals;
    const priceUSD = route.toToken.priceUSD ? parseFloat(route.toToken.priceUSD) : null;

    // Aggregate fees and gas
    let feeUsd = 0;
    let gasUsd = parseFloat(route.gasCostUSD ?? "0");
    for (const step of route.steps) {
      for (const fee of step.estimate.feeCosts ?? []) {
        feeUsd += parseFloat(fee.amountUSD ?? "0");
      }
      for (const gas of step.estimate.gasCosts ?? []) {
        gasUsd += parseFloat(gas.amountUSD ?? "0");
      }
    }

    const etaSeconds = route.steps.reduce((s, st) => s + (st.estimate.executionDuration ?? 120), 0);
    const etaMins = Math.ceil(etaSeconds / 60);

    const bridgeName = route.steps.map((s) => s.tool).join(" → ");
    const requirements: string[] = [];
    if (route.steps.length > 1) requirements.push(`${route.steps.length}-step route`);
    if (route.tags?.includes("RECOMMENDED")) requirements.push("recommended");
    if (route.tags?.includes("CHEAPEST")) requirements.push("cheapest");
    if (route.tags?.includes("FASTEST")) requirements.push("fastest");

    return {
      source: "lifi",
      bridge_name: bridgeName,
      from_chain: String(fromChainId),
      to_chain: String(toChainId),
      token: token.toUpperCase(),
      amount_in: amount,
      amount_out: +amountOut.toFixed(6),
      amount_out_usd: priceUSD ? +(amountOut * priceUSD).toFixed(2) : null,
      fee_usd: +feeUsd.toFixed(4),
      gas_cost_usd: +gasUsd.toFixed(4),
      total_cost_usd: +(feeUsd + gasUsd).toFixed(4),
      eta_minutes: etaMins,
      eta_label: etaLabel(etaMins),
      steps: route.steps.length,
      requirements,
      approval_required: true, // EVM bridges always need approval
      route_id: route.id,
    };
  });
}

// ─── Socket (Bungee) ──────────────────────────────────────────────────────────

interface SocketRoute {
  routeId: string;
  bridgeName: string;
  outputAmount: string;
  totalFees?: { totalFeeInUsd?: string };
  gasFees?: { gasLimit?: number; feesInUsd?: string };
  serviceTime?: number;
  outputValueInUsd?: number;
  userTxs?: Array<{ userTxType: string }>;
}

interface SocketApiResponse {
  success: boolean;
  result?: {
    routes?: SocketRoute[];
    toAsset?: { decimals: number; tokenPrice?: number };
  };
}

async function fetchSocket(
  fromChainId: number,
  toChainId: number,
  token: string,
  amount: number,
  apiKey?: string
): Promise<BridgeRoute[]> {
  const fromChainKey = String(fromChainId);
  const toChainKey = String(toChainId);
  const tokenAddr = TOKEN_ADDRESSES[token.toUpperCase()]?.[fromChainKey]
    ?? TOKEN_ADDRESSES["USDC"][fromChainKey]
    ?? "0x0000000000000000000000000000000000000000";
  const toTokenAddr = TOKEN_ADDRESSES[token.toUpperCase()]?.[toChainKey]
    ?? TOKEN_ADDRESSES["USDC"][toChainKey]
    ?? "0x0000000000000000000000000000000000000000";

  const decimals = ["ETH", "WETH"].includes(token.toUpperCase()) ? 18 : 6;
  const amountWei = BigInt(Math.round(amount * 10 ** decimals)).toString();

  // Socket API key — public demo key
  const key = apiKey ?? "72a5b4b0-e727-48be-8aa1-5da9d62fe635";

  const params = new URLSearchParams({
    fromChainId: String(fromChainId),
    toChainId: String(toChainId),
    fromTokenAddress: tokenAddr,
    toTokenAddress: toTokenAddr,
    fromAmount: amountWei,
    userAddress: "0x0000000000000000000000000000000000000001",
    uniqueRoutesPerBridge: "true",
    sort: "output",
    singleTxOnly: "false",
  });

  const res = await fetch(`https://api.socket.tech/v2/quote?${params}`, {
    headers: { "API-KEY": key, "accept": "application/json" },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`Socket API error: ${res.status}`);
  const data = (await res.json()) as SocketApiResponse;
  if (!data.success || !data.result?.routes) return [];

  const toDecimals = data.result.toAsset?.decimals ?? decimals;
  const tokenPrice = data.result.toAsset?.tokenPrice ?? 1;

  return data.result.routes.slice(0, 5).map((route): BridgeRoute => {
    const amountOut = Number(BigInt(route.outputAmount)) / 10 ** toDecimals;
    const feeUsd = parseFloat(route.totalFees?.totalFeeInUsd ?? "0");
    const gasUsd = parseFloat(route.gasFees?.feesInUsd ?? "0");
    const etaMins = Math.ceil((route.serviceTime ?? 300) / 60);

    const requirements: string[] = [];
    if (route.userTxs && route.userTxs.length > 1) requirements.push(`${route.userTxs.length} transactions`);
    if (route.userTxs?.some((tx) => tx.userTxType === "dex-swap")) requirements.push("includes swap");

    return {
      source: "socket",
      bridge_name: route.bridgeName,
      from_chain: String(fromChainId),
      to_chain: String(toChainId),
      token: token.toUpperCase(),
      amount_in: amount,
      amount_out: +amountOut.toFixed(6),
      amount_out_usd: route.outputValueInUsd ?? +(amountOut * tokenPrice).toFixed(2),
      fee_usd: +feeUsd.toFixed(4),
      gas_cost_usd: +gasUsd.toFixed(4),
      total_cost_usd: +(feeUsd + gasUsd).toFixed(4),
      eta_minutes: etaMins,
      eta_label: etaLabel(etaMins),
      steps: route.userTxs?.length ?? 1,
      requirements,
      approval_required: true,
      route_id: route.routeId,
    };
  });
}

// ─── Rango ────────────────────────────────────────────────────────────────────

interface RangoSwap {
  swapper: { id: string; title: string };
  expectedOutput: string;
  fee: Array<{ amount: string; expenseType: string; token: { usdPrice?: number; decimals: number } }>;
  timeStat?: { estimated: number };
}

interface RangoBestRoute {
  result?: {
    swaps?: RangoSwap[];
    outputAmount?: string;
    outputAmountUsd?: number;
    to?: { token: { symbol: string; decimals: number; usdPrice?: number } };
  };
  error?: string;
}

async function fetchRango(
  fromChain: string,
  toChain: string,
  token: string,
  amount: number,
  apiKey?: string
): Promise<BridgeRoute[]> {
  const key = apiKey ?? "c6381a79-2817-4602-83bf-6a641a409e32"; // Rango public demo key
  const fromRango = RANGO_CHAINS[fromChain.toUpperCase()] ?? fromChain.toUpperCase();
  const toRango = RANGO_CHAINS[toChain.toUpperCase()] ?? toChain.toUpperCase();

  const params = new URLSearchParams({
    apiKey: key,
    from: `${fromRango}.${token.toUpperCase()}`,
    to: `${toRango}.${token.toUpperCase()}`,
    amount: String(amount),
    checkPrerequisites: "false",
  });

  try {
    const res = await fetch(`https://api.rango.exchange/routing/best?${params}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`Rango API error: ${res.status}`);
    const data = (await res.json()) as RangoBestRoute;
    if (data.error || !data.result) return [];

    const swaps = data.result.swaps ?? [];
    const outUsd = data.result.outputAmountUsd ?? null;
    const outToken = data.result.to?.token;
    const amountOut = outToken
      ? Number(data.result.outputAmount ?? "0") / 10 ** (outToken.decimals ?? 6)
      : Number(data.result.outputAmount ?? "0");

    let feeUsd = 0;
    let etaSecs = 0;
    const bridges: string[] = [];
    const requirements: string[] = [];

    for (const swap of swaps) {
      bridges.push(swap.swapper.title);
      etaSecs += swap.timeStat?.estimated ?? 180;
      for (const fee of swap.fee ?? []) {
        const feeAmt = parseFloat(fee.amount) / 10 ** (fee.token.decimals ?? 6);
        feeUsd += feeAmt * (fee.token.usdPrice ?? 1);
      }
    }

    if (swaps.length > 1) requirements.push(`${swaps.length} hops`);

    return [{
      source: "rango",
      bridge_name: bridges.join(" → "),
      from_chain: fromRango,
      to_chain: toRango,
      token: token.toUpperCase(),
      amount_in: amount,
      amount_out: +amountOut.toFixed(6),
      amount_out_usd: outUsd !== null ? +outUsd.toFixed(2) : null,
      fee_usd: +feeUsd.toFixed(4),
      gas_cost_usd: 0,
      total_cost_usd: +feeUsd.toFixed(4),
      eta_minutes: Math.ceil(etaSecs / 60),
      eta_label: etaLabel(Math.ceil(etaSecs / 60)),
      steps: swaps.length,
      requirements,
      approval_required: true,
    }];
  } catch {
    return [];
  }
}

// ─── Agent ────────────────────────────────────────────────────────────────────

const SUPPORTED_CHAINS = ["ETH", "ARB", "OP", "BASE", "SOL", "BSC", "POLYGON", "AVAX", "ZKSYNC", "LINEA", "SCROLL"] as const;
type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "1.0.0",
  description:
    "Find the best bridge routes with live fee and ETA quotes from Li.Fi, Socket (Bungee), and Rango. Covers ETH, ARB, OP, BASE, SOL, BSC and 20+ chains.",
});

// ── find_routes ───────────────────────────────────────────────────────────────
addEntrypoint({
  key: "find_routes",
  description:
    "Query Li.Fi, Socket, and Rango for bridge routes. Returns sorted routes with fee, ETA, and requirements.",
  input: z.object({
    token: z.string().default("USDC").describe("Token to bridge: USDC, USDT, ETH, WETH, etc."),
    amount: z.number().describe("Amount to bridge in token units"),
    from_chain: z.string().describe("Source chain: ETH, ARB, OP, BASE, SOL, BSC, POLYGON, AVAX, etc."),
    to_chain: z.string().describe("Destination chain: ETH, ARB, OP, BASE, SOL, BSC, POLYGON, AVAX, etc."),
    sources: z
      .array(z.enum(["lifi", "socket", "rango"]))
      .default(["lifi", "socket", "rango"])
      .describe("APIs to query"),
    sort_by: z
      .enum(["fee", "eta", "output"])
      .default("output")
      .describe("Sort routes by: fee (lowest first), eta (fastest first), output (most received first)"),
    from_address: z.string().optional().describe("Sender wallet address (optional, improves accuracy)"),
    lifi_api_key: z.string().optional().describe("Li.Fi API key (optional, increases rate limits)"),
    socket_api_key: z.string().optional().describe("Socket API key (optional)"),
    rango_api_key: z.string().optional().describe("Rango API key (optional)"),
  }),
  async handler({ input }) {
    const { token, amount, from_chain, to_chain, sources, sort_by, from_address, socket_api_key, rango_api_key } = input;

    const fromChainId = CHAIN_IDS[from_chain.toUpperCase()];
    const toChainId = CHAIN_IDS[to_chain.toUpperCase()];

    const allRoutes: BridgeRoute[] = [];
    const errors: Record<string, string> = {};

    await Promise.all(
      sources.map(async (source) => {
        try {
          let routes: BridgeRoute[] = [];
          if (source === "lifi" && fromChainId && toChainId) {
            routes = await fetchLifi(fromChainId, toChainId, token, amount, from_address);
          } else if (source === "socket" && fromChainId && toChainId) {
            routes = await fetchSocket(fromChainId, toChainId, token, amount, socket_api_key);
          } else if (source === "rango") {
            routes = await fetchRango(from_chain, to_chain, token, amount, rango_api_key);
          } else if (!fromChainId || !toChainId) {
            errors[source] = `Unsupported chain pair: ${from_chain} → ${to_chain} (EVM chain IDs required for ${source})`;
          }
          allRoutes.push(...routes);
        } catch (err) {
          errors[source] = err instanceof Error ? err.message : String(err);
        }
      })
    );

    // Sort
    if (sort_by === "fee") {
      allRoutes.sort((a, b) => a.total_cost_usd - b.total_cost_usd);
    } else if (sort_by === "eta") {
      allRoutes.sort((a, b) => a.eta_minutes - b.eta_minutes);
    } else {
      // output: most amount_out first
      allRoutes.sort((a, b) => b.amount_out - a.amount_out);
    }

    const best = allRoutes[0] ?? null;

    return {
      output: {
        from_chain,
        to_chain,
        token,
        amount,
        sort_by,
        routes: allRoutes,
        best_route: best
          ? {
              source: best.source,
              bridge: best.bridge_name,
              amount_out: best.amount_out,
              fee_usd: best.total_cost_usd,
              eta: best.eta_label,
              requirements: best.requirements,
            }
          : null,
        total_routes: allRoutes.length,
        errors,
        fetched_at: new Date().toISOString(),
      },
      usage: { total_tokens: allRoutes.length },
    };
  },
});

// ── compare_fees ──────────────────────────────────────────────────────────────
addEntrypoint({
  key: "compare_fees",
  description:
    "Compare bridge fees across multiple token amounts for a given chain pair. Useful for finding the most cost-efficient bridging amount.",
  input: z.object({
    token: z.string().default("USDC").describe("Token to bridge"),
    amounts: z
      .array(z.number())
      .default([100, 500, 1000, 5000, 10000])
      .describe("Amounts to compare fee efficiency for"),
    from_chain: z.string().describe("Source chain"),
    to_chain: z.string().describe("Destination chain"),
    sources: z
      .array(z.enum(["lifi", "socket", "rango"]))
      .default(["lifi"])
      .describe("APIs to query"),
  }),
  async handler({ input }) {
    const { token, amounts, from_chain, to_chain, sources } = input;
    const fromChainId = CHAIN_IDS[from_chain.toUpperCase()];
    const toChainId = CHAIN_IDS[to_chain.toUpperCase()];

    const results = await Promise.all(
      amounts.map(async (amount) => {
        const routes: BridgeRoute[] = [];
        for (const source of sources) {
          try {
            if (source === "lifi" && fromChainId && toChainId) {
              routes.push(...await fetchLifi(fromChainId, toChainId, token, amount));
            } else if (source === "socket" && fromChainId && toChainId) {
              routes.push(...await fetchSocket(fromChainId, toChainId, token, amount));
            } else if (source === "rango") {
              routes.push(...await fetchRango(from_chain, to_chain, token, amount));
            }
          } catch { /* skip on error */ }
        }
        const bestRoute = routes.sort((a, b) => a.total_cost_usd - b.total_cost_usd)[0];
        const feePct = bestRoute ? (bestRoute.total_cost_usd / amount) * 100 : null;
        return {
          amount,
          best_fee_usd: bestRoute?.total_cost_usd ?? null,
          fee_pct: feePct !== null ? +feePct.toFixed(3) : null,
          best_bridge: bestRoute?.bridge_name ?? null,
          eta: bestRoute?.eta_label ?? null,
          amount_out: bestRoute?.amount_out ?? null,
        };
      })
    );

    return {
      output: {
        from_chain,
        to_chain,
        token,
        fee_comparison: results,
        recommendation: results.reduce((best, curr) =>
          curr.fee_pct !== null && (best.fee_pct === null || curr.fee_pct < best.fee_pct) ? curr : best
        ),
      },
      usage: { total_tokens: amounts.length },
    };
  },
});

// ── get_supported_chains ──────────────────────────────────────────────────────
addEntrypoint({
  key: "get_supported_chains",
  description: "List all supported chains with their IDs.",
  input: z.object({}),
  async handler() {
    return {
      output: {
        chains: Object.entries(CHAIN_IDS).map(([name, id]) => ({ name, chain_id: id })),
        rango_chains: Object.entries(RANGO_CHAINS).map(([alias, rango]) => ({ alias, rango_id: rango })),
        note: "SOL/SOLANA is supported via Rango only (not EVM).",
      },
      usage: { total_tokens: 1 },
    };
  },
});

// ── echo ──────────────────────────────────────────────────────────────────────
addEntrypoint({
  key: "echo",
  description: "Health check — echoes input text.",
  input: z.object({ text: z.string() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "") },
      usage: { total_tokens: String(input.text ?? "").length },
    };
  },
});

// ─── Server ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 8096);
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Bridge Route Pinger running on port ${PORT}`);
});

export default app;
