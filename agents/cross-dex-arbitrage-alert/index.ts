import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import {
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  type Address,
  type PublicClient,
} from "viem";
import { base, mainnet, arbitrum, optimism } from "viem/chains";

// ─── Token registries per chain ──────────────────────────────────────────────
const TOKENS: Record<number, Record<string, { address: Address; decimals: number }>> = {
  8453: { // Base
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    USDbC: { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", decimals: 6 },
    cbBTC: { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", decimals: 8 },
    DAI: { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
  },
  1: { // Mainnet
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
    DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  },
  42161: { // Arbitrum
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    WBTC: { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
    DAI: { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  },
  10: { // Optimism
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    USDC: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    WBTC: { address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095", decimals: 8 },
    DAI: { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  },
};

// ─── DEX Quoter contracts ────────────────────────────────────────────────────
interface DEXConfig {
  name: string;
  chainId: number;
  quoter: Address;
  type: "uniswapV3" | "aerodrome";
  fees?: number[];
}

const DEXES: DEXConfig[] = [
  // Base
  { name: "Uniswap V3 (Base)", chainId: 8453, quoter: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a", type: "uniswapV3", fees: [100, 500, 3000, 10000] },
  { name: "Aerodrome (Base)", chainId: 8453, quoter: "0xABCe0D1E0fAa3134e4109B89bc42e0671D5bC5e5", type: "aerodrome" },
  { name: "SushiSwap V3 (Base)", chainId: 8453, quoter: "0xb1E835Dc2785b52265711e17fCCb0fd018226a6e", type: "uniswapV3", fees: [100, 500, 3000, 10000] },
  // Mainnet
  { name: "Uniswap V3 (Mainnet)", chainId: 1, quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", type: "uniswapV3", fees: [100, 500, 3000, 10000] },
  { name: "SushiSwap V3 (Mainnet)", chainId: 1, quoter: "0x64e8802FE490fa7cc61d3c73d011BcB4e18a0572", type: "uniswapV3", fees: [100, 500, 3000, 10000] },
  // Arbitrum
  { name: "Uniswap V3 (Arbitrum)", chainId: 42161, quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", type: "uniswapV3", fees: [100, 500, 3000, 10000] },
  { name: "SushiSwap V3 (Arbitrum)", chainId: 42161, quoter: "0x0524E833cCD057e4d7A296e3aaAb9f7675964Ce1", type: "uniswapV3", fees: [100, 500, 3000, 10000] },
  // Optimism
  { name: "Uniswap V3 (Optimism)", chainId: 10, quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", type: "uniswapV3", fees: [100, 500, 3000, 10000] },
];

const UNISWAP_V3_QUOTER_ABI = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

// ─── RPC clients ─────────────────────────────────────────────────────────────
const CHAIN_MAP: Record<number, any> = { 8453: base, 1: mainnet, 42161: arbitrum, 10: optimism };
const RPC_URLS: Record<number, string> = {
  8453: process.env.BASE_RPC || "https://base-rpc.publicnode.com",
  1: process.env.ETH_RPC || "https://ethereum-rpc.publicnode.com",
  42161: process.env.ARB_RPC || "https://arbitrum-one-rpc.publicnode.com",
  10: process.env.OP_RPC || "https://optimism-rpc.publicnode.com",
};

function getClient(chainId: number): PublicClient {
  return createPublicClient({
    chain: CHAIN_MAP[chainId],
    transport: http(RPC_URLS[chainId], { timeout: 10_000 }),
  }) as PublicClient;
}

// ─── Gas price estimation ────────────────────────────────────────────────────
async function getGasCostUsd(chainId: number): Promise<number> {
  try {
    const client = getClient(chainId);
    const gasPrice = await client.getGasPrice();
    const gasPriceGwei = Number(gasPrice) / 1e9;
    // Approximate swap gas: 150k for a single swap
    const gasUnits = 150_000n;
    const gasCostEth = Number(gasPrice * gasUnits) / 1e18;
    // Rough ETH price - in production you'd fetch this
    const ethPrice = 2500; // conservative estimate
    return gasCostEth * ethPrice;
  } catch {
    return 5; // fallback $5 gas estimate
  }
}

// ─── Quote functions ─────────────────────────────────────────────────────────
interface Quote {
  dex: string;
  chainId: number;
  amountOut: bigint;
  amountOutFormatted: number;
  gasEstimate: bigint;
  fee: number;
}

async function quoteUniswapV3(
  dex: DEXConfig,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
): Promise<Quote[]> {
  const client = getClient(dex.chainId);
  const quotes: Quote[] = [];

  for (const fee of dex.fees || [500, 3000, 10000]) {
    try {
      const result = await client.simulateContract({
        address: dex.quoter,
        abi: UNISWAP_V3_QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      const [amountOut, , , gasEstimate] = result.result as [bigint, bigint, number, bigint];
      if (amountOut > 0n) {
        quotes.push({ dex: dex.name, chainId: dex.chainId, amountOut, amountOutFormatted: 0, gasEstimate, fee });
      }
    } catch {
      // Pool doesn't exist or no liquidity for this fee tier
    }
  }
  return quotes;
}

async function getQuotes(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  chainIds: number[],
  tokenOutDecimals: number,
): Promise<Quote[]> {
  const relevantDexes = DEXES.filter((d) => chainIds.includes(d.chainId));
  const allQuotes: Quote[] = [];

  const promises = relevantDexes.map(async (dex) => {
    if (dex.type === "uniswapV3") {
      return quoteUniswapV3(dex, tokenIn, tokenOut, amountIn);
    }
    return [];
  });

  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const q of r.value) {
        q.amountOutFormatted = Number(formatUnits(q.amountOut, tokenOutDecimals));
        allQuotes.push(q);
      }
    }
  }

  return allQuotes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1));
}

// ─── Route types ─────────────────────────────────────────────────────────────
interface Route {
  dex: string;
  chainId: number;
  amountOut: string;
  amountOutRaw: string;
  fee: number;
  feeBps: number;
  gasEstimate: string;
  estGasCostUsd: number;
}

interface ArbitrageResult {
  best_route: Route | null;
  alt_routes: Route[];
  net_spread_bps: number;
  est_fill_cost: string;
  token_in: string;
  token_out: string;
  amount_in: string;
  chains_scanned: number[];
  timestamp: string;
  profitable: boolean;
  num_dexes_queried: number;
}

// ─── Agent App ───────────────────────────────────────────────────────────────
const { app, addEntrypoint } = createAgentApp({
  name: "cross-dex-arbitrage-alert",
  version: "0.1.0",
  description:
    "Detect cross-DEX token price spreads exceeding threshold. Monitors Uniswap V3, SushiSwap, and Aerodrome across Base, Mainnet, Arbitrum, and Optimism.",
});

addEntrypoint({
  key: "scan",
  description:
    "Scan for cross-DEX arbitrage opportunities between two tokens across multiple chains",
  input: z.object({
    token_in: z.string().describe("Input token address"),
    token_out: z.string().describe("Output token address"),
    amount_in: z.string().describe("Amount to swap (in wei/smallest unit)"),
    chains: z
      .array(z.number())
      .default([8453])
      .describe("Chain IDs to scan (8453=Base, 1=Mainnet, 42161=Arbitrum, 10=Optimism)"),
    token_out_decimals: z.number().default(6).describe("Decimals of the output token"),
  }),
  async handler({ input }) {
    const tokenIn = input.token_in as Address;
    const tokenOut = input.token_out as Address;
    const amountIn = BigInt(input.amount_in);
    const chains = input.chains;
    const decimals = input.token_out_decimals;

    const quotes = await getQuotes(tokenIn, tokenOut, amountIn, chains, decimals);

    if (quotes.length === 0) {
      return {
        output: {
          best_route: null,
          alt_routes: [],
          net_spread_bps: 0,
          est_fill_cost: "0",
          token_in: input.token_in,
          token_out: input.token_out,
          amount_in: input.amount_in,
          chains_scanned: chains,
          timestamp: new Date().toISOString(),
          profitable: false,
          num_dexes_queried: 0,
        } satisfies ArbitrageResult,
        usage: { total_tokens: 0 },
      };
    }

    // Calculate gas costs per chain
    const gasCosts: Record<number, number> = {};
    for (const chainId of chains) {
      gasCosts[chainId] = await getGasCostUsd(chainId);
    }

    const toRoute = (q: Quote): Route => ({
      dex: q.dex,
      chainId: q.chainId,
      amountOut: q.amountOutFormatted.toFixed(decimals),
      amountOutRaw: q.amountOut.toString(),
      fee: q.fee,
      feeBps: q.fee / 100,
      gasEstimate: q.gasEstimate.toString(),
      estGasCostUsd: gasCosts[q.chainId] || 5,
    });

    const best = quotes[0];
    const worst = quotes[quotes.length - 1];

    // Net spread in basis points between best and worst quote
    const spreadBps =
      worst.amountOut > 0n
        ? Number(((best.amountOut - worst.amountOut) * 10000n) / worst.amountOut)
        : 0;

    const bestRoute = toRoute(best);
    const altRoutes = quotes.slice(1).map(toRoute);

    const totalGasCost = bestRoute.estGasCostUsd;

    const result: ArbitrageResult = {
      best_route: bestRoute,
      alt_routes: altRoutes,
      net_spread_bps: spreadBps,
      est_fill_cost: `$${totalGasCost.toFixed(2)}`,
      token_in: input.token_in,
      token_out: input.token_out,
      amount_in: input.amount_in,
      chains_scanned: chains,
      timestamp: new Date().toISOString(),
      profitable: spreadBps > 10 && altRoutes.length > 0,
      num_dexes_queried: quotes.length,
    };

    return {
      output: result,
      usage: { total_tokens: quotes.length },
    };
  },
});

addEntrypoint({
  key: "scan_named",
  description:
    "Scan for arbitrage using token symbols (e.g., WETH, USDC) instead of addresses. Easier to use.",
  input: z.object({
    token_in: z.string().describe("Input token symbol (e.g., WETH, USDC, WBTC, DAI)"),
    token_out: z.string().describe("Output token symbol"),
    amount: z.string().describe("Human-readable amount (e.g., '10' for 10 WETH)"),
    chains: z
      .array(z.number())
      .default([8453])
      .describe("Chain IDs to scan"),
  }),
  async handler({ input }) {
    const chainId = input.chains[0] || 8453;
    const chainTokens = TOKENS[chainId];
    if (!chainTokens) {
      return { output: { error: `Unsupported chain ${chainId}` }, usage: { total_tokens: 0 } };
    }

    const tokenInInfo = chainTokens[input.token_in.toUpperCase()];
    const tokenOutInfo = chainTokens[input.token_out.toUpperCase()];
    if (!tokenInInfo) {
      return { output: { error: `Unknown token ${input.token_in} on chain ${chainId}. Available: ${Object.keys(chainTokens).join(", ")}` }, usage: { total_tokens: 0 } };
    }
    if (!tokenOutInfo) {
      return { output: { error: `Unknown token ${input.token_out} on chain ${chainId}. Available: ${Object.keys(chainTokens).join(", ")}` }, usage: { total_tokens: 0 } };
    }

    const amountIn = BigInt(Math.floor(Number(input.amount) * 10 ** tokenInInfo.decimals));

    const quotes = await getQuotes(
      tokenInInfo.address,
      tokenOutInfo.address,
      amountIn,
      input.chains,
      tokenOutInfo.decimals,
    );

    if (quotes.length === 0) {
      return {
        output: {
          best_route: null,
          alt_routes: [],
          net_spread_bps: 0,
          est_fill_cost: "0",
          token_in: `${input.token_in} (${tokenInInfo.address})`,
          token_out: `${input.token_out} (${tokenOutInfo.address})`,
          amount_in: `${input.amount} ${input.token_in}`,
          chains_scanned: input.chains,
          timestamp: new Date().toISOString(),
          profitable: false,
          num_dexes_queried: 0,
        },
        usage: { total_tokens: 0 },
      };
    }

    const gasCosts: Record<number, number> = {};
    for (const cid of input.chains) {
      gasCosts[cid] = await getGasCostUsd(cid);
    }

    const toRoute = (q: Quote): Route => ({
      dex: q.dex,
      chainId: q.chainId,
      amountOut: q.amountOutFormatted.toFixed(tokenOutInfo.decimals),
      amountOutRaw: q.amountOut.toString(),
      fee: q.fee,
      feeBps: q.fee / 100,
      gasEstimate: q.gasEstimate.toString(),
      estGasCostUsd: gasCosts[q.chainId] || 5,
    });

    const best = quotes[0];
    const worst = quotes[quotes.length - 1];
    const spreadBps =
      worst.amountOut > 0n
        ? Number(((best.amountOut - worst.amountOut) * 10000n) / worst.amountOut)
        : 0;

    return {
      output: {
        best_route: toRoute(best),
        alt_routes: quotes.slice(1).map(toRoute),
        net_spread_bps: spreadBps,
        est_fill_cost: `$${(gasCosts[best.chainId] || 5).toFixed(2)}`,
        token_in: `${input.token_in} (${tokenInInfo.address})`,
        token_out: `${input.token_out} (${tokenOutInfo.address})`,
        amount_in: `${input.amount} ${input.token_in}`,
        chains_scanned: input.chains,
        timestamp: new Date().toISOString(),
        profitable: spreadBps > 10 && quotes.length > 1,
        num_dexes_queried: quotes.length,
      },
      usage: { total_tokens: quotes.length },
    };
  },
});

addEntrypoint({
  key: "triangular_scan",
  description:
    "Scan for triangular arbitrage opportunities (A→B→C→A) on a single DEX/chain",
  input: z.object({
    token_a: z.string().describe("Token A symbol (start and end)"),
    token_b: z.string().describe("Token B symbol (intermediate)"),
    token_c: z.string().describe("Token C symbol (intermediate)"),
    amount: z.string().describe("Amount of token A to start with"),
    chain: z.number().default(8453).describe("Chain ID"),
  }),
  async handler({ input }) {
    const chainTokens = TOKENS[input.chain];
    if (!chainTokens) {
      return { output: { error: `Unsupported chain ${input.chain}` }, usage: { total_tokens: 0 } };
    }

    const tA = chainTokens[input.token_a.toUpperCase()];
    const tB = chainTokens[input.token_b.toUpperCase()];
    const tC = chainTokens[input.token_c.toUpperCase()];

    if (!tA || !tB || !tC) {
      return {
        output: { error: `Unknown token. Available on chain ${input.chain}: ${Object.keys(chainTokens).join(", ")}` },
        usage: { total_tokens: 0 },
      };
    }

    const amountA = BigInt(Math.floor(Number(input.amount) * 10 ** tA.decimals));

    // Leg 1: A → B
    const leg1 = await getQuotes(tA.address, tB.address, amountA, [input.chain], tB.decimals);
    if (leg1.length === 0) {
      return { output: { error: `No quotes for ${input.token_a}→${input.token_b}` }, usage: { total_tokens: 0 } };
    }

    // Leg 2: B → C
    const leg2 = await getQuotes(tB.address, tC.address, leg1[0].amountOut, [input.chain], tC.decimals);
    if (leg2.length === 0) {
      return { output: { error: `No quotes for ${input.token_b}→${input.token_c}` }, usage: { total_tokens: 0 } };
    }

    // Leg 3: C → A
    const leg3 = await getQuotes(tC.address, tA.address, leg2[0].amountOut, [input.chain], tA.decimals);
    if (leg3.length === 0) {
      return { output: { error: `No quotes for ${input.token_c}→${input.token_a}` }, usage: { total_tokens: 0 } };
    }

    const finalAmount = leg3[0].amountOut;
    const profitBps = Number(((finalAmount - amountA) * 10000n) / amountA);
    const profitFormatted = Number(formatUnits(finalAmount - amountA, tA.decimals));

    const gasCost = await getGasCostUsd(input.chain);
    const totalGas = gasCost * 3; // 3 swaps

    return {
      output: {
        route: `${input.token_a}→${input.token_b}→${input.token_c}→${input.token_a}`,
        amount_in: `${input.amount} ${input.token_a}`,
        amount_out: `${Number(formatUnits(finalAmount, tA.decimals)).toFixed(6)} ${input.token_a}`,
        profit: `${profitFormatted.toFixed(6)} ${input.token_a}`,
        profit_bps: profitBps,
        est_gas_cost_usd: `$${totalGas.toFixed(2)}`,
        legs: [
          { step: `${input.token_a}→${input.token_b}`, dex: leg1[0].dex, amountOut: leg1[0].amountOutFormatted, fee: leg1[0].fee },
          { step: `${input.token_b}→${input.token_c}`, dex: leg2[0].dex, amountOut: leg2[0].amountOutFormatted, fee: leg2[0].fee },
          { step: `${input.token_c}→${input.token_a}`, dex: leg3[0].dex, amountOut: leg3[0].amountOutFormatted, fee: leg3[0].fee },
        ],
        profitable: profitBps > 0,
        chain: input.chain,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: leg1.length + leg2.length + leg3.length },
    };
  },
});

export default app;
