import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

const { app, addEntrypoint } = createAgentApp({
  name: "slippage-sentinel",
  version: "0.1.0",
  description: "Estimate safe slippage tolerance for any route",
});

const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)",
];

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)",
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function getPoolDepth(
  provider: ethers.Provider,
  pairAddress: string
): Promise<{ reserve0: bigint; reserve1: bigint; decimals0: number; decimals1: number } | null> {
  try {
    const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    const [reserves, token0, token1] = await Promise.all([
      pairContract.getReserves(),
      pairContract.token0(),
      pairContract.token1(),
    ]);

    const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
    const [decimals0, decimals1] = await Promise.all([
      token0Contract.decimals(),
      token1Contract.decimals(),
    ]);

    return {
      reserve0: reserves[0],
      reserve1: reserves[1],
      decimals0,
      decimals1,
    };
  } catch (error) {
    console.error("Error getting pool depth:", error);
    return null;
  }
}

async function getRecentTradeSizes(
  provider: ethers.Provider,
  routerAddress: string,
  tokenIn: string,
  tokenOut: string
): Promise<number[]> {
  try {
    // Query recent swap events to calculate 95th percentile
    // This is simplified - in production use The Graph or indexer
    const routerContract = new ethers.Contract(
      routerAddress,
      ["event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"],
      provider
    );

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000); // Last ~1000 blocks

    const swapFilter = routerContract.filters.Swap();
    const swaps = await routerContract.queryFilter(swapFilter, fromBlock, currentBlock);

    const tradeSizes: number[] = [];
    for (const swap of swaps) {
      if (swap.args) {
        const amount0In = Number(swap.args.amount0In || 0);
        const amount1In = Number(swap.args.amount1In || 0);
        const size = amount0In + amount1In;
        if (size > 0) {
          tradeSizes.push(size);
        }
      }
    }

    return tradeSizes;
  } catch (error) {
    console.error("Error getting recent trade sizes:", error);
    return [];
  }
}

function calculatePriceImpact(
  reserveIn: bigint,
  reserveOut: bigint,
  amountIn: bigint
): number {
  // Constant product formula: x * y = k
  // After swap: (x + Δx) * (y - Δy) = k
  // Price impact = (expected - actual) / expected
  
  const k = reserveIn * reserveOut;
  const newReserveIn = reserveIn + amountIn;
  const newReserveOut = k / newReserveIn;
  const amountOut = reserveOut - newReserveOut;
  
  const expectedOut = (amountIn * reserveOut) / reserveIn;
  const priceImpact = Number((expectedOut - amountOut) * BigInt(10000) / expectedOut);
  
  return Math.max(0, priceImpact);
}

function getPercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

async function calculateSlippage(
  provider: ethers.Provider,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  routeHint: string
): Promise<{
  min_safe_slip_bps: number;
  pool_depths: { reserve0: string; reserve1: string };
  recent_trade_size_p95: string;
}> {
  try {
    const amountInBigInt = BigInt(amountIn);
    
    // Try to find pool address from route hint or try common routers
    let pairAddress: string | null = null;
    
    if (routeHint.includes("0x") && routeHint.length === 42) {
      pairAddress = routeHint;
    } else {
      // Try to find pair via Uniswap V2 factory
      const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
      const FACTORY_ABI = [
        "function getPair(address tokenA, address tokenB) view returns (address pair)",
      ];
      const factory = new ethers.Contract(UNISWAP_V2_FACTORY, FACTORY_ABI, provider);
      pairAddress = await factory.getPair(tokenIn, tokenOut);
      if (pairAddress === ethers.ZeroAddress) {
        pairAddress = await factory.getPair(tokenOut, tokenIn);
      }
    }

    if (!pairAddress || pairAddress === ethers.ZeroAddress) {
      // Default safe slippage if pool not found
      return {
        min_safe_slip_bps: 100, // 1% default
        pool_depths: { reserve0: "0", reserve1: "0" },
        recent_trade_size_p95: "0",
      };
    }

    const poolDepth = await getPoolDepth(provider, pairAddress);
    if (!poolDepth) {
      return {
        min_safe_slip_bps: 100,
        pool_depths: { reserve0: "0", reserve1: "0" },
        recent_trade_size_p95: "0",
      };
    }

    // Determine which token is which based on pair
    const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    const [token0, token1] = await Promise.all([
      pairContract.token0(),
      pairContract.token1(),
    ]);

    let reserveIn: bigint;
    let reserveOut: bigint;

    if (tokenIn.toLowerCase() === token0.toLowerCase()) {
      reserveIn = poolDepth.reserve0;
      reserveOut = poolDepth.reserve1;
    } else {
      reserveIn = poolDepth.reserve1;
      reserveOut = poolDepth.reserve0;
    }

    // Calculate price impact
    const priceImpactBps = calculatePriceImpact(reserveIn, reserveOut, amountInBigInt);

    // Get recent trade sizes for volatility estimation
    const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const tradeSizes = await getRecentTradeSizes(provider, UNISWAP_V2_ROUTER, tokenIn, tokenOut);
    
    let recentTradeSizeP95 = "0";
    if (tradeSizes.length > 0) {
      const sorted = [...tradeSizes].sort((a, b) => a - b);
      const p95 = getPercentile(sorted, 95);
      recentTradeSizeP95 = Math.floor(p95).toString();
    }

    // Calculate safe slippage: price impact + volatility buffer
    // Add 20% buffer on top of price impact for safety
    const volatilityBuffer = tradeSizes.length > 0 ? 20 : 50; // More buffer if no trade data
    const minSafeSlipBps = Math.max(50, Math.ceil(priceImpactBps * 1.2) + volatilityBuffer);

    return {
      min_safe_slip_bps: Math.min(minSafeSlipBps, 5000), // Cap at 50%
      pool_depths: {
        reserve0: poolDepth.reserve0.toString(),
        reserve1: poolDepth.reserve1.toString(),
      },
      recent_trade_size_p95: recentTradeSizeP95,
    };
  } catch (error) {
    console.error("Error calculating slippage:", error);
    return {
      min_safe_slip_bps: 100,
      pool_depths: { reserve0: "0", reserve1: "0" },
      recent_trade_size_p95: "0",
    };
  }
}

addEntrypoint({
  key: "estimate_slippage",
  description: "Suggest safe slippage for a specific swap route",
  input: z.object({
    token_in: z.string().describe("Input token address"),
    token_out: z.string().describe("Output token address"),
    amount_in: z.string().describe("Amount to swap"),
    route_hint: z.string().optional().describe("Suggested route/DEX"),
  }),
  async handler({ input }) {
    try {
      const rpcUrl = process.env.RPC_URL || "https://eth.llamarpc.com";
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const result = await calculateSlippage(
        provider,
        input.token_in,
        input.token_out,
        input.amount_in,
        input.route_hint || ""
      );

      return {
        output: result,
        usage: {
          total_tokens: JSON.stringify(result).length,
        },
      };
    } catch (error: any) {
      return {
        output: {
          error: error.message || "Unknown error occurred",
          min_safe_slip_bps: 100,
          pool_depths: { reserve0: "0", reserve1: "0" },
          recent_trade_size_p95: "0",
        },
        usage: {
          total_tokens: 100,
        },
      };
    }
  },
});

// Start HTTP server if run directly
import { serve } from '@hono/node-server';

// Always start server when run as main module
const port = Number(process.env.PORT) || 3000;
serve({
  fetch: app.fetch,
  port,
}, () => {
  console.log(`Agent server running on http://localhost:${port}`);
});

export default app;
