import { createPublicClient, http, type Address, encodeFunctionData, decodeFunctionResult } from "viem";
import { base } from "viem/chains";

export type DexQuote = {
  dex: string;
  chainId: number;
  amountOut: bigint;
  pool?: string;
};

// Uniswap V3 Quoter V2 on Base
const UNISWAP_V3_QUOTER: Record<number, Address> = {
  8453: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
};

// Aerodrome (Velodrome V2 fork) Router on Base  
const AERODROME_ROUTER: Address = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";

// SushiSwap V3 Quoter on Base
const SUSHI_V3_QUOTER: Record<number, Address> = {
  8453: "0xb1E835Dc2785b52265711e17fCCb0fd018226a6e",
};

const QUOTER_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

const FEES = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%

function getClient(chainId: number) {
  if (chainId === 8453) {
    return createPublicClient({
      chain: base,
      transport: http("https://1rpc.io/base"),
    });
  }
  throw new Error(`Unsupported chain: ${chainId}`);
}

async function getUniswapV3Quote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  chainId: number
): Promise<DexQuote | null> {
  const quoter = UNISWAP_V3_QUOTER[chainId];
  if (!quoter) return null;

  const client = getClient(chainId);
  let bestOut = 0n;

  for (const fee of FEES) {
    try {
      const result = await client.simulateContract({
        address: quoter,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: tokenIn as Address,
            tokenOut: tokenOut as Address,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      const out = result.result[0];
      if (out > bestOut) bestOut = out;
    } catch {
      // Fee tier not available for this pair
    }
  }

  if (bestOut === 0n) return null;
  return { dex: "uniswap_v3", chainId, amountOut: bestOut };
}

async function getSushiV3Quote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  chainId: number
): Promise<DexQuote | null> {
  const quoter = SUSHI_V3_QUOTER[chainId];
  if (!quoter) return null;

  const client = getClient(chainId);
  let bestOut = 0n;

  for (const fee of FEES) {
    try {
      const result = await client.simulateContract({
        address: quoter,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: tokenIn as Address,
            tokenOut: tokenOut as Address,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      const out = result.result[0];
      if (out > bestOut) bestOut = out;
    } catch {
      // Fee tier not available
    }
  }

  if (bestOut === 0n) return null;
  return { dex: "sushiswap_v3", chainId, amountOut: bestOut };
}

async function getAerodromeQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  chainId: number
): Promise<DexQuote | null> {
  if (chainId !== 8453) return null; // Aerodrome only on Base

  const client = getClient(chainId);

  // Aerodrome uses getAmountsOut with routes
  const ROUTER_ABI = [
    {
      name: "getAmountsOut",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "amountIn", type: "uint256" },
        {
          name: "routes",
          type: "tuple[]",
          components: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "stable", type: "bool" },
            { name: "factory", type: "address" },
          ],
        },
      ],
      outputs: [{ name: "amounts", type: "uint256[]" }],
    },
  ] as const;

  const FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" as Address;

  // Try both stable and volatile
  for (const stable of [false, true]) {
    try {
      const result = await client.readContract({
        address: AERODROME_ROUTER,
        abi: ROUTER_ABI,
        functionName: "getAmountsOut",
        args: [
          amountIn,
          [
            {
              from: tokenIn as Address,
              to: tokenOut as Address,
              stable,
              factory: FACTORY,
            },
          ],
        ],
      });
      const amounts = result as bigint[];
      if (amounts.length > 1 && amounts[amounts.length - 1] > 0n) {
        return {
          dex: `aerodrome_${stable ? "stable" : "volatile"}`,
          chainId,
          amountOut: amounts[amounts.length - 1],
        };
      }
    } catch {
      // Pool doesn't exist
    }
  }

  return null;
}

export async function getQuotes(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  chainIds: number[]
): Promise<DexQuote[]> {
  const promises: Promise<DexQuote | null>[] = [];

  for (const chainId of chainIds) {
    promises.push(getUniswapV3Quote(tokenIn, tokenOut, amountIn, chainId));
    promises.push(getSushiV3Quote(tokenIn, tokenOut, amountIn, chainId));
    promises.push(getAerodromeQuote(tokenIn, tokenOut, amountIn, chainId));
  }

  const results = await Promise.allSettled(promises);
  return results
    .filter((r): r is PromiseFulfilledResult<DexQuote | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((q): q is DexQuote => q !== null);
}
