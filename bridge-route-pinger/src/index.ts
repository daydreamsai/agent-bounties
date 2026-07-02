import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import type { Usage } from "@lucid-dreams/agent-kit";

// ── Chain ID mapping ──────────────────────────────────────────────────────────

const CHAIN_IDS: Record<string, number> = {
  eth: 1,
  ethereum: 1,
  optimism: 10,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  base: 8453,
  avalanche: 43114,
};

// ── Token address cache ───────────────────────────────────────────────────────

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
}

let tokensCache: TokenInfo[] | null = null;
let tokensCacheTime = 0;
const TOKENS_CACHE_TTL = 60_000; // 1 minute

async function fetchTokens(): Promise<TokenInfo[]> {
  const now = Date.now();
  if (tokensCache && now - tokensCacheTime < TOKENS_CACHE_TTL) {
    return tokensCache;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch("https://li.quest/v1/tokens", {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Li.Finance tokens API returned ${res.status}`);
    }
    const data = (await res.json()) as {
      tokens: Record<string, TokenInfo[]>;
    };
    const all: TokenInfo[] = [];
    for (const chainKey of Object.keys(data.tokens)) {
      for (const t of data.tokens[chainKey]) {
        all.push(t);
      }
    }
    tokensCache = all;
    tokensCacheTime = now;
    return all;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Li.Finance API types ──────────────────────────────────────────────────────

interface LiGasCost {
  type?: string;
  estimate?: string;
  limit?: string;
  amount?: string;
  amountUSD?: string;
  token?: string;
}

interface LiFeeCost {
  name?: string;
  description?: string;
  percentage?: string;
  token?: string;
  amount?: string;
  amountUSD?: string;
}

interface LiStepEstimate {
  toAmount?: string;
  fromAmount?: string;
  toAmountMin?: string;
  gasCosts?: LiGasCost[];
  feeCosts?: LiFeeCost[];
  approvalAddress?: string;
  executable?: boolean;
}

interface LiStepAction {
  fromChainId?: number;
  fromAmount?: string;
  fromToken?: string;
  toChainId?: number;
  toToken?: string;
  slippage?: number;
}

interface LiStep {
  tool?: string;
  estimate?: LiStepEstimate;
  action?: LiStepAction;
}

interface LiRouteEstimate {
  toAmount?: string;
  toAmountMin?: string;
  gasCosts?: LiGasCost[];
  feeCosts?: LiFeeCost[];
}

interface LiRoute {
  transactionRequest?: unknown;
  estimate?: LiRouteEstimate;
  tool?: string;
  includedSteps?: LiStep[];
}

interface RoutesResponse {
  routes?: LiRoute[];
}

// ── Helper: combine abort signals ─────────────────────────────────────────────

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason);
      return controller.signal;
    }
    sig.addEventListener("abort", () => controller.abort(sig.reason), {
      once: true,
    });
  }
  return controller.signal;
}

// ── Fetch bridge routes from Li.Finance ───────────────────────────────────────

async function fetchRoutes(
  fromChain: number,
  toChain: number,
  fromToken: string,
  toToken: string,
  fromAmount: string,
  signal?: AbortSignal,
): Promise<LiRoute[]> {
  const params = new URLSearchParams({
    fromChain: String(fromChain),
    toChain: String(toChain),
    fromToken,
    toToken,
    fromAmount,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  const combinedSignal = signal
    ? combineAbortSignals(signal, controller.signal)
    : controller.signal;

  try {
    const res = await fetch(`https://li.quest/v1/routes?${params}`, {
      signal: combinedSignal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Li.Finance routes API returned ${res.status}: ${body.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as RoutesResponse;
    return data.routes ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

// ── Parse amount string to smallest unit ──────────────────────────────────────

function parseAmount(value: string, decimals: number): string {
  const clean = value.replace(/[^0-9.]/g, "");
  const parts = clean.split(".");
  if (parts.length > 2) {
    throw new Error(`Invalid amount format: ${value}`);
  }

  if (parts.length === 2) {
    const whole = parts[0];
    let fraction = parts[1].slice(0, decimals);
    fraction = fraction.padEnd(decimals, "0");
    return whole + fraction;
  }

  return clean.padEnd(clean.length + decimals, "0");
}

// ── Estimate gas costs from a step ────────────────────────────────────────────

function estimateGasCost(step: LiStep): string {
  const gasCosts = step.estimate?.gasCosts;
  if (!gasCosts || gasCosts.length === 0) {
    return "N/A";
  }

  const total = gasCosts.reduce(
    (sum: number, gc: LiGasCost) =>
      sum + (gc.amountUSD ? parseFloat(gc.amountUSD) : 0),
    0,
  );

  return `$${total.toFixed(2)}`;
}

// ── Format a single LiRoute into the output shape ─────────────────────────────

interface FormattedRoute {
  name: string;
  from_amount: string;
  to_amount: string;
  fee_usd: string;
  eta_minutes: number;
  gas_cost_estimate: string;
}

function formatRoute(route: LiRoute): FormattedRoute {
  const name =
    route.tool ??
    route.includedSteps?.[0]?.tool ??
    route.includedSteps
      ?.map((s) => s.tool)
      .filter(Boolean)
      .join(" → ") ??
    "Unknown";

  const firstStep = route.includedSteps?.[0];
  const lastStep = route.includedSteps?.[route.includedSteps.length - 1];

  const fromAmount = firstStep?.estimate?.fromAmount ?? firstStep?.action?.fromAmount ?? "0";
  const toAmount = route.estimate?.toAmount ?? lastStep?.estimate?.toAmount ?? "0";

  const feeCosts =
    route.estimate?.feeCosts ?? firstStep?.estimate?.feeCosts ?? [];
  const totalFeeUsd = feeCosts.reduce(
    (sum: number, fc: LiFeeCost) =>
      sum + (fc.amountUSD ? parseFloat(fc.amountUSD) : 0),
    0,
  );

  const gasCost = firstStep ? estimateGasCost(firstStep) : "N/A";
  const etaMinutes = estimateETA(name, route.includedSteps);

  return {
    name,
    from_amount: fromAmount,
    to_amount: toAmount,
    fee_usd: `$${totalFeeUsd.toFixed(2)}`,
    eta_minutes: etaMinutes,
    gas_cost_estimate: gasCost,
  };
}

// ── Estimate ETA based on bridge type ─────────────────────────────────────────

function estimateETA(
  bridgeName: string,
  steps: LiStep[] | undefined,
): number {
  if (steps && steps.length > 0) {
    let total = 0;
    for (const step of steps) {
      const tool = (step.tool ?? "").toLowerCase();
      if (tool.includes("across")) total += 3;
      else if (tool.includes("stargate")) total += 5;
      else if (tool.includes("hop")) total += 7;
      else if (tool.includes("synapse")) total += 5;
      else if (tool.includes("celer")) total += 3;
      else if (tool.includes("connext")) total += 2;
      else if (tool.includes("multichain") || tool.includes("anyswap"))
        total += 10;
      else if (tool.includes("wormhole")) total += 15;
      else if (tool.includes("layerzero")) total += 5;
      else if (tool.includes("debridge")) total += 3;
      else if (tool.includes("lifi")) total += 3;
      else if (tool.includes("squid") || tool.includes("axelar")) total += 5;
      else total += 5;
    }
    return total;
  }

  const name = bridgeName.toLowerCase();
  if (name.includes("across")) return 3;
  if (name.includes("stargate")) return 5;
  if (name.includes("hop")) return 7;
  if (name.includes("synapse")) return 5;
  if (name.includes("celer")) return 3;
  if (name.includes("connext")) return 2;
  if (name.includes("wormhole")) return 15;
  return 10;
}

// ── Extract requirements (gas tokens needed) ──────────────────────────────────

function getRequirements(routes: LiRoute[]): Record<string, string> {
  const requirements: Record<string, string> = {};

  const chains = new Set<number>();
  for (const route of routes) {
    for (const step of route.includedSteps ?? []) {
      if (step.action?.fromChainId) chains.add(step.action.fromChainId);
      if (step.action?.toChainId) chains.add(step.action.toChainId);
    }
  }

  if (chains.size > 0) {
    const chainNames = Array.from(chains)
      .map((id: number) => {
        const entry = Object.entries(CHAIN_IDS).find(([, v]) => v === id);
        return entry ? entry[0] : String(id);
      })
      .join(", ");
    requirements.gas_tokens_needed_on = chainNames;
    requirements.note =
      "Ensure you have native gas tokens (ETH, MATIC, BNB, etc.) on the source chain to cover bridge transaction costs.";
  }

  return requirements;
}

// ── Create the agent app ──────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "Bridge Route Pinger",
  version: "0.1.0",
  description:
    "Provides bridge route quotes for cross-chain token transfers. " +
    "Supports USDC, USDT, ETH, WETH, DAI across Ethereum, Optimism, BSC, Polygon, Arbitrum, Base, and Avalanche.",
});

addEntrypoint({
  key: "bridge-routes",
  description:
    "Get bridge route quotes for transferring tokens across chains. " +
    "Returns estimated receive amounts, fees, gas costs, and estimated time for each route.",
  input: z.object({
    token: z
      .string()
      .describe(
        "Token address or symbol (e.g. 'USDC', 'ETH', 'USDT', 'DAI', 'WETH', or a contract address)",
      ),
    amount: z
      .string()
      .describe(
        "Amount to bridge in human-readable format (e.g. '100' for 100 USDC, '0.5' for 0.5 ETH)",
      ),
    from_chain: z
      .string()
      .describe(
        "Source chain name: eth, optimism, bsc, polygon, arbitrum, base, avalanche",
      ),
    to_chain: z
      .string()
      .describe(
        "Destination chain name: eth, optimism, bsc, polygon, arbitrum, base, avalanche",
      ),
  }),
  async handler(ctx) {
    const input = ctx.input as {
      token: string;
      amount: string;
      from_chain: string;
      to_chain: string;
    };
    const { token, amount, from_chain, to_chain } = input;

    // Helper to build usage
    const usage = (tokens: number): Usage => ({ total_tokens: tokens });

    try {
      // ── Validate chains ────────────────────────────────────────────

      const fromChainId = CHAIN_IDS[from_chain.toLowerCase()];
      const toChainId = CHAIN_IDS[to_chain.toLowerCase()];

      if (!fromChainId) {
        return {
          output: {
            error: `Unsupported source chain: "${from_chain}". Supported chains: ${Object.keys(CHAIN_IDS).join(", ")}`,
          },
          usage: usage(15),
        };
      }

      if (!toChainId) {
        return {
          output: {
            error: `Unsupported destination chain: "${to_chain}". Supported chains: ${Object.keys(CHAIN_IDS).join(", ")}`,
          },
          usage: usage(15),
        };
      }

      if (fromChainId === toChainId) {
        return {
          output: {
            error:
              "Source and destination chains are the same. Bridge routes require different chains.",
          },
          usage: usage(15),
        };
      }

      // ── Validate amount ────────────────────────────────────────────

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return {
          output: {
            error: `Invalid amount: "${amount}". Please provide a positive number.`,
          },
          usage: usage(15),
        };
      }

      // ── Resolve token ──────────────────────────────────────────────

      const rawToken = token.trim();
      let fromTokenAddress: string;
      let toTokenAddress: string;
      let resolvedSymbol: string;

      if (/^0x[a-fA-F0-9]{40}$/.test(rawToken)) {
        fromTokenAddress = rawToken;
        toTokenAddress = rawToken;
        resolvedSymbol = rawToken.slice(0, 6) + "..." + rawToken.slice(-4);
      } else {
        const allTokens = await fetchTokens();
        const symbol = rawToken.toUpperCase();

        const sourceTokens = allTokens.filter(
          (t) =>
            t.chainId === fromChainId &&
            t.symbol.toUpperCase() === symbol,
        );

        const destTokens = allTokens.filter(
          (t) =>
            t.chainId === toChainId &&
            t.symbol.toUpperCase() === symbol,
        );

        if (sourceTokens.length === 0) {
          return {
            output: {
              error: `Token "${rawToken}" not found on chain "${from_chain}". Check the Li.Finance token list for supported tokens.`,
            },
            usage: usage(15),
          };
        }

        fromTokenAddress = sourceTokens[0].address;
        toTokenAddress =
          destTokens.length > 0
            ? destTokens[0].address
            : sourceTokens[0].address;
        resolvedSymbol = sourceTokens[0].symbol;

        // ETH is native token (address(0)) on most chains
        if (symbol === "ETH") {
          fromTokenAddress = "0x0000000000000000000000000000000000000000";
          toTokenAddress = "0x0000000000000000000000000000000000000000";
        }
      }

      // ── Convert amount to smallest unit ────────────────────────────

      let decimals = 18;
      try {
        const allTokens = await fetchTokens();
        const found = allTokens.find(
          (t) =>
            t.chainId === fromChainId &&
            t.address.toLowerCase() === fromTokenAddress.toLowerCase(),
        );
        if (found) {
          decimals = found.decimals;
        }
      } catch {
        // Use default 18 decimals
      }

      const amountSmallest = parseAmount(amount, decimals);

      // ── Fetch routes from Li.Finance ───────────────────────────────

      const routes = await fetchRoutes(
        fromChainId,
        toChainId,
        fromTokenAddress,
        toTokenAddress,
        amountSmallest,
        ctx.signal,
      );

      // ── Format results ─────────────────────────────────────────────

      if (routes.length === 0) {
        return {
          output: {
            routes: [],
            requirements: getRequirements(routes),
            message: `No bridge routes found for ${resolvedSymbol} from ${from_chain} to ${to_chain}. The token may not be bridgeable on this pair, or no liquidity is available.`,
          },
          usage: usage(30),
        };
      }

      const formattedRoutes = routes.map(formatRoute);
      const requirements = getRequirements(routes);

      return {
        output: {
          routes: formattedRoutes,
          requirements,
          summary: {
            token: resolvedSymbol,
            amount,
            from_chain,
            to_chain,
            routes_found: formattedRoutes.length,
          },
        },
        usage: usage(formattedRoutes.length * 10 + 30),
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      const isTimeout =
        err instanceof DOMException && err.name === "AbortError";

      return {
        output: {
          error: isTimeout
            ? "Request timed out while fetching bridge routes. The Li.Finance API may be slow or unavailable. Please try again."
            : `Failed to fetch bridge routes: ${message}`,
        },
        usage: usage(10),
      };
    }
  },
});

export default app;
