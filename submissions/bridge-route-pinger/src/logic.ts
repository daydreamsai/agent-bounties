const LIFI_BASE = "https://li.quest/v1";

/**
 * Dummy sender used for read-only quote requests.
 * LI.FI requires a fromAddress but we only need pricing data, not tx calldata.
 */
const DUMMY_ADDRESS = "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0";

// ---------------------------------------------------------------------------
// Chain ID mapping
// ---------------------------------------------------------------------------

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  avalanche: 43114,
  bsc: 56,
  gnosis: 100,
  fantom: 250,
  zksync: 324,
  linea: 59144,
  scroll: 534352,
};

// ---------------------------------------------------------------------------
// Well-known token addresses per chain
// ---------------------------------------------------------------------------

const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  USDC: {
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
  "USDC.e": {
    42161: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    10: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
    137: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  },
  USDT: {
    1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
  },
  DAI: {
    1: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    42161: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    10: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    137: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    8453: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  },
  WETH: {
    1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    10: "0x4200000000000000000000000000000000000006",
    8453: "0x4200000000000000000000000000000000000006",
    137: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  },
  ETH: {
    1: "0x0000000000000000000000000000000000000000",
    42161: "0x0000000000000000000000000000000000000000",
    10: "0x0000000000000000000000000000000000000000",
    8453: "0x0000000000000000000000000000000000000000",
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BridgeRoute {
  name: string;
  protocol: string;
  estimated_output: string;
  estimated_output_usd: string;
  eta_minutes: number;
  fee_usd: string;
  fee_breakdown: Array<{ name: string; amount_usd: string }>;
  gas_cost_usd: string;
  gas_token: string;
}

export interface FindRoutesResult {
  routes: BridgeRoute[];
  from_chain: string;
  to_chain: string;
  token: string;
  amount: string;
  requirements: string[];
  queried_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveChainId(chain: string): number {
  const normalized = chain.toLowerCase().trim();
  const id = CHAIN_IDS[normalized];
  if (id !== undefined) return id;

  // Allow raw numeric chain IDs
  const parsed = parseInt(normalized, 10);
  if (!isNaN(parsed) && parsed > 0) return parsed;

  throw new Error(
    `Unsupported chain: "${chain}". Supported: ${Object.keys(CHAIN_IDS).join(", ")}`
  );
}

function resolveTokenAddress(
  symbol: string,
  chainId: number
): string {
  const upper = symbol.toUpperCase().trim();

  // If it already looks like an address, return as-is
  if (symbol.startsWith("0x") && symbol.length === 42) {
    return symbol;
  }

  const perChain = TOKEN_ADDRESSES[upper];
  if (perChain) {
    const addr = perChain[chainId];
    if (addr) return addr;
  }

  // Fall back to passing the symbol directly -- LI.FI can resolve common symbols
  return upper;
}

function tokenDecimals(symbol: string): number {
  const upper = symbol.toUpperCase().trim();
  if (["USDC", "USDC.E", "USDT"].includes(upper)) return 6;
  if (["DAI"].includes(upper)) return 18;
  if (["ETH", "WETH"].includes(upper)) return 18;
  // Default: try 18 (most ERC-20s)
  return 18;
}

function humanAmountToRaw(amount: string, symbol: string): string {
  const decimals = tokenDecimals(symbol);
  const parts = amount.split(".");
  const whole = parts[0] ?? "0";
  let frac = parts[1] ?? "";
  if (frac.length > decimals) {
    frac = frac.slice(0, decimals);
  } else {
    frac = frac.padEnd(decimals, "0");
  }
  // Strip leading zeros from the concatenated result
  const raw = (whole + frac).replace(/^0+/, "") || "0";
  return raw;
}

function rawToHuman(raw: string, decimals: number): string {
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals);
  // Trim trailing zeros from fraction
  const trimmed = frac.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

// ---------------------------------------------------------------------------
// LI.FI API calls
// ---------------------------------------------------------------------------

interface LifiRouteStep {
  tool: string;
  toolDetails: { key: string; name: string; logoURI?: string };
  estimate: {
    tool: string;
    toAmount: string;
    toAmountMin: string;
    fromAmount: string;
    executionDuration?: number;
    feeCosts?: Array<{
      name: string;
      amount: string;
      amountUSD: string;
      percentage: string;
      token: { symbol: string; decimals: number };
      included: boolean;
    }>;
    gasCosts?: Array<{
      type: string;
      amount: string;
      amountUSD: string;
      token: { symbol: string; decimals: number };
    }>;
  };
  action: {
    fromToken: { symbol: string; decimals: number; priceUSD: string };
    toToken: { symbol: string; decimals: number; priceUSD: string };
    fromAmount: string;
  };
}

interface LifiRoute {
  id: string;
  fromAmountUSD: string;
  toAmount: string;
  toAmountUSD: string;
  toAmountMin: string;
  toToken: { symbol: string; decimals: number };
  gasCostUSD: string;
  steps: LifiRouteStep[];
}

interface LifiRoutesResponse {
  routes: LifiRoute[];
}

async function fetchAdvancedRoutes(
  fromChainId: number,
  toChainId: number,
  fromTokenAddress: string,
  toTokenAddress: string,
  fromAmount: string
): Promise<LifiRoutesResponse> {
  const body = {
    fromChainId,
    toChainId,
    fromTokenAddress,
    toTokenAddress,
    fromAmount,
    fromAddress: DUMMY_ADDRESS,
    options: {
      slippage: 0.03,
      order: "RECOMMENDED",
    },
  };

  const resp = await fetch(`${LIFI_BASE}/advanced/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LI.FI /advanced/routes failed (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<LifiRoutesResponse>;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export async function findBridgeRoutes(input: {
  token: string;
  amount: string;
  from_chain: string;
  to_chain: string;
}): Promise<FindRoutesResult> {
  const { token, amount, from_chain, to_chain } = input;

  const fromChainId = resolveChainId(from_chain);
  const toChainId = resolveChainId(to_chain);

  const fromTokenAddress = resolveTokenAddress(token, fromChainId);
  const toTokenAddress = resolveTokenAddress(token, toChainId);

  const rawAmount = humanAmountToRaw(amount, token);

  const data = await fetchAdvancedRoutes(
    fromChainId,
    toChainId,
    fromTokenAddress,
    toTokenAddress,
    rawAmount
  );

  const requirements: string[] = [];
  const routes: BridgeRoute[] = [];

  if (!data.routes || data.routes.length === 0) {
    return {
      routes: [],
      from_chain,
      to_chain,
      token,
      amount,
      requirements: [
        `No bridge routes found for ${token} from ${from_chain} to ${to_chain}. The token may not be supported on one or both chains, or the amount may be too small.`,
      ],
      queried_at: new Date().toISOString(),
    };
  }

  // Track what gas tokens are needed
  const gasTokensNeeded = new Set<string>();

  for (const route of data.routes) {
    // Aggregate across all steps in a route
    let totalFeesUsd = 0;
    let totalGasUsd = 0;
    let totalDurationSec = 0;
    const feeBreakdown: Array<{ name: string; amount_usd: string }> = [];
    let gasTokenSymbol = "ETH";
    let protocolName = "";
    let protocolKey = "";

    for (const step of route.steps) {
      protocolName = step.toolDetails?.name ?? step.tool;
      protocolKey = step.toolDetails?.key ?? step.tool;

      if (step.estimate.executionDuration) {
        totalDurationSec += step.estimate.executionDuration;
      }

      if (step.estimate.feeCosts) {
        for (const fee of step.estimate.feeCosts) {
          const usd = parseFloat(fee.amountUSD) || 0;
          totalFeesUsd += usd;
          feeBreakdown.push({
            name: fee.name,
            amount_usd: fee.amountUSD,
          });
        }
      }

      if (step.estimate.gasCosts) {
        for (const gas of step.estimate.gasCosts) {
          const usd = parseFloat(gas.amountUSD) || 0;
          totalGasUsd += usd;
          gasTokenSymbol = gas.token?.symbol ?? "ETH";
          gasTokensNeeded.add(gasTokenSymbol);
        }
      }
    }

    const toDecimals = route.toToken?.decimals ?? tokenDecimals(token);
    const estimatedOutput = rawToHuman(route.toAmount, toDecimals);

    routes.push({
      name: protocolName,
      protocol: protocolKey,
      estimated_output: `${estimatedOutput} ${route.toToken?.symbol ?? token}`,
      estimated_output_usd: `$${route.toAmountUSD}`,
      eta_minutes: Math.max(Math.ceil(totalDurationSec / 60), 1),
      fee_usd: `$${totalFeesUsd.toFixed(4)}`,
      fee_breakdown: feeBreakdown,
      gas_cost_usd: `$${totalGasUsd.toFixed(4)}`,
      gas_token: gasTokenSymbol,
    });
  }

  // Build requirements
  if (gasTokensNeeded.size > 0) {
    const tokens = Array.from(gasTokensNeeded).join(", ");
    requirements.push(
      `Source chain gas token needed: ${tokens} on ${from_chain}`
    );
  }
  requirements.push(
    `Token approval may be required before bridging (ERC-20 approve to bridge contract)`
  );

  return {
    routes,
    from_chain,
    to_chain,
    token,
    amount,
    requirements,
    queried_at: new Date().toISOString(),
  };
}
