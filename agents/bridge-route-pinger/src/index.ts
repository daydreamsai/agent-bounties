/**
 * Bridge Route Pinger
 *
 * Answers one question for an agent holding a token on chain A and wanting it on chain B:
 * which bridges can do it right now, what does each cost, how long does each take, and what
 * does the caller need before starting.
 *
 * Data comes from LI.FI's /advanced/routes, which aggregates live quotes across bridges
 * rather than reporting a single best path. Every number in the response is copied from a live
 * quote taken during the request, so a caller can re-run the same call and get the same shape.
 */
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { mountPaywall } from "./paywall.ts";
import { quotePreflight } from "./preflight.ts";

const LIFI = "https://li.quest/v1";

/** Native-token placeholders LI.FI accepts in place of an ERC-20 address. */
const NATIVE = "0x0000000000000000000000000000000000000000";

export const CHAINS: Record<string, number> = {
  ethereum: 1, base: 8453, arbitrum: 42161, optimism: 10, polygon: 137,
  bsc: 56, avalanche: 43114, gnosis: 100, linea: 59144, scroll: 534352,
  zksync: 324, mantle: 5000, blast: 81457, mode: 34443, celo: 42220,
};

/** Tokens we can resolve to an address without a lookup, keyed by chain id. */
export const TOKENS: Record<string, Record<string, { address: string; decimals: number }>> = {
  "8453": {
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    USDT: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    ETH: { address: NATIVE, decimals: 18 },
  },
  "42161": {
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    ETH: { address: NATIVE, decimals: 18 },
  },
  "1": {
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    ETH: { address: NATIVE, decimals: 18 },
  },
  "10": {
    USDC: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    USDT: { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    ETH: { address: NATIVE, decimals: 18 },
  },
  "137": {
    USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    POL: { address: NATIVE, decimals: 18 },
  },
};

export function resolveChain(name: string | number): number | null {
  if (typeof name === "number") return name;
  const key = String(name).trim().toLowerCase();
  if (CHAINS[key]) return CHAINS[key];
  const n = Number(key);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveToken(chainId: number, symbol: string) {
  const raw = String(symbol || "").trim();
  const key = raw.toUpperCase();
  const table = TOKENS[String(chainId)];
  if (table && table[key]) return table[key];
  // An address passed straight through, with 18 decimals assumed when unknown. Tested against the
  // original string: uppercasing first turns `0x…` into `0X…` and no address ever matches.
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) return { address: raw, decimals: 18 };
  return null;
}

export function toAtomic(amount: string, decimals: number): string {
  const [whole, frac = ""] = String(amount).split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0")).toString();
}

export function fromAtomic(atomic: string, decimals: number): number {
  const n = BigInt(atomic || "0");
  const base = 10n ** BigInt(decimals);
  return Number(n / base) + Number(n % base) / Number(base);
}

export type RouteOut = {
  bridge: string;
  eta_minutes: number | null;
  fee_usd: number;
  to_amount: number;
  to_amount_usd: number | null;
  gas_usd: number | null;
  requirements: string[];
  steps: number;
};

async function fetchRoutes(params: {
  fromChain: number; toChain: number; fromToken: string; toToken: string;
  fromAmount: string; fromAddress: string;
}) {
  const res = await fetch(`${LIFI}/advanced/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromChainId: params.fromChain,
      toChainId: params.toChain,
      fromTokenAddress: params.fromToken,
      toTokenAddress: params.toToken,
      fromAmount: params.fromAmount,
      fromAddress: params.fromAddress,
      options: { allowSwitchChain: true, integrator: "bridge-route-pinger" },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`lifi ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as { routes?: any[] };
}

export function toRouteOut(route: any, decimals: number): RouteOut {
  const first = (route.steps || [])[0] || {};
  const est = first.estimate || {};
  const feeCosts = est.feeCosts || [];
  const feeUsd = feeCosts.reduce((sum: number, f: any) => {
    const v = Number(f.amountUSD);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  const gas = Number(route.gasCostUSD);
  const requirements: string[] = [];
  if (route.containsSwitchChain) requirements.push("wallet must switch chain");
  if (est.approvalAddress) requirements.push(`approve token at ${est.approvalAddress}`);
  const gasToken = (first.action?.fromToken?.symbol || "") as string;
  if (gasToken) requirements.push(`hold ${gasToken} for gas`);
  // A zero or missing executionDuration means LI.FI did not report a time; reporting 0 would
  // read as "instant", so the field is null instead.
  const seconds = Number(est.executionDuration || 0);
  return {
    bridge: String(first.tool || "unknown"),
    eta_minutes: seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null,
    fee_usd: Number(feeUsd.toFixed(4)),
    to_amount: fromAtomic(String(route.toAmount || "0"), decimals),
    to_amount_usd: route.toAmountUSD != null ? Number(route.toAmountUSD) : null,
    gas_usd: Number.isFinite(gas) ? gas : null,
    requirements,
    steps: (route.steps || []).length,
  };
}

/**
 * Order by what the caller actually receives, not by the headline fee: two routes can charge the
 * same fee and still differ by 0.7% in delivered amount. Ties fall back to the faster route.
 */
export function rank(a: RouteOut, b: RouteOut): number {
  const av = a.to_amount_usd ?? a.to_amount;
  const bv = b.to_amount_usd ?? b.to_amount;
  if (bv !== av) return bv - av;
  return (a.eta_minutes ?? 1e9) - (b.eta_minutes ?? 1e9);
}

/**
 * Price in USD, not atomic units: the middleware multiplies by the token decimals itself, so
 * "1000" would mean $1000 rather than $0.001.
 */
const price = process.env.PRICE_USD || "0.002";

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "0.1.0",
  description:
    "Lists live bridge routes for a token transfer between chains, with fee, ETA and the prerequisites each route needs.",
});

// Mounted before any entrypoint is registered: Hono runs middleware in registration order, so a
// paywall added after the route handler would never see the request.
if (process.env.ADDRESS) {
  mountPaywall(app, {
    payTo: process.env.ADDRESS as `0x${string}`,
    price,
    facilitatorUrl: process.env.FACILITATOR_URL || "https://facilitator.payai.network",
    network: process.env.NETWORK || "eip155:8453",
    path: "/entrypoints/quote/invoke",
    description: "Live bridge routes for one transfer, best delivered amount first",
    preflight: (input) => {
      const r = quotePreflight(input);
      return r.ok ? null : r.error;
    },
  });
}

addEntrypoint({
  key: "quote",
  description: "Live bridge routes for one transfer, best delivered amount first",
  input: z.object({
    token: z.string().describe("Token symbol or address, e.g. USDC"),
    amount: z.string().describe("Human amount, e.g. 10 or 10.5"),
    from_chain: z.string().describe("Source chain name or id, e.g. base"),
    to_chain: z.string().describe("Destination chain name or id, e.g. arbitrum"),
    from_address: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .optional()
      .describe("Sender address; a placeholder is used when omitted"),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  output: z.object({
    token: z.string(),
    amount: z.string(),
    from_chain: z.number(),
    to_chain: z.number(),
    routes: z.array(
      z.object({
        bridge: z.string(),
        eta_minutes: z.number().nullable(),
        fee_usd: z.number(),
        to_amount: z.number(),
        to_amount_usd: z.number().nullable(),
        gas_usd: z.number().nullable(),
        requirements: z.array(z.string()),
        steps: z.number(),
      }),
    ),
    best: z.string().nullable(),
    quoted_at: z.string(),
  }),
  async handler({ input }) {
    const fromChain = resolveChain(input.from_chain);
    const toChain = resolveChain(input.to_chain);
    if (fromChain == null) throw new Error(`unknown from_chain: ${input.from_chain}`);
    if (toChain == null) throw new Error(`unknown to_chain: ${input.to_chain}`);
    if (fromChain === toChain) throw new Error("from_chain and to_chain must differ");
    const fromToken = resolveToken(fromChain, input.token);
    const toToken = resolveToken(toChain, input.token);
    if (!fromToken || !toToken) {
      throw new Error(`unknown token ${input.token} on chain ${fromChain} or ${toChain}`);
    }
    const fromAddress = input.from_address || "0x0000000000000000000000000000000000000001";
    const raw = await fetchRoutes({
      fromChain,
      toChain,
      fromToken: fromToken.address,
      toToken: toToken.address,
      fromAmount: toAtomic(input.amount, fromToken.decimals),
      fromAddress,
    });
    const routes = (raw.routes || [])
      .map((r) => toRouteOut(r, toToken.decimals))
      .sort(rank)
      .slice(0, input.limit ?? 5);
    return {
      output: {
        token: input.token,
        amount: input.amount,
        from_chain: fromChain,
        to_chain: toChain,
        routes,
        best: routes[0]?.bridge ?? null,
        quoted_at: new Date().toISOString(),
      },
      usage: { total_tokens: String(routes.length) },
    };
  },
});

addEntrypoint({
  key: "chains",
  description: "Chain names this agent can resolve",
  input: z.object({}),
  output: z.object({ chains: z.array(z.object({ name: z.string(), id: z.number() })) }),
  async handler() {
    return {
      output: {
        chains: Object.entries(CHAINS).map(([name, id]) => ({ name, id })),
      },
    };
  },
});

export default app;
