import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

const { app, addEntrypoint } = createAgentApp({
  name: "lp-impermanent-loss-estimator",
  version: "0.1.0",
  description: "Calculate IL and fee APR for any LP position",
});

interface ILResult {
  IL_percent: number;
  fee_apr_est: number;
  volume_window: string;
  notes: string[];
}

const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
  "event Sync(uint112 reserve0, uint112 reserve1)",
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
];

const FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)",
];

function calculateImpermanentLoss(
  priceRatio: number // Current price / Initial price
): number {
  // IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
  if (priceRatio <= 0) return 0;
  const sqrtRatio = Math.sqrt(priceRatio);
  const il = (2 * sqrtRatio) / (1 + priceRatio) - 1;
  return Math.abs(il) * 100; // Return as positive percentage
}

function estimateFeeAPR(
  volume: bigint,
  tvl: bigint,
  feeBps: number,
  windowHours: number
): number {
  // APR = (volume * fee_bps / 10000) / tvl * (365 * 24 / window_hours)
  if (tvl === BigInt(0)) return 0;
  const totalFee = (volume * BigInt(feeBps)) / BigInt(10000);
  const hoursPerYear = 365 * 24;
  const periodMultiplier = hoursPerYear / windowHours;
  const apr = (Number(totalFee) / Number(tvl)) * periodMultiplier * 100;
  return apr;
}

async function getHistoricalPrice(
  provider: ethers.Provider,
  pairAddress: string,
  windowHours: number
): Promise<{ initialPrice: number; currentPrice: number } | null> {
  try {
    const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    
    // Calculate blocks to scan (approx 12 blocks/min for Ethereum)
    const blocksPerHour = 720;
    const blocksToScan = Math.ceil(windowHours * blocksPerHour);
    const fromBlock = Math.max(0, currentBlock - blocksToScan);
    
    // Get current reserves
    const currentReserves = await pairContract.getReserves();
    const [token0, token1] = await Promise.all([
      pairContract.token0(),
      pairContract.token1(),
    ]);
    
    // Get token decimals
    const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
    const [decimals0, decimals1] = await Promise.all([
      token0Contract.decimals(),
      token1Contract.decimals(),
    ]);
    
    const currentPrice = Number(currentReserves[1]) / Number(currentReserves[0]) * 
                        (10 ** Number(decimals0)) / (10 ** Number(decimals1));
    
    // Try to find initial price from Sync events or pair creation
    let initialPrice = currentPrice;
    
    try {
      const syncFilter = pairContract.filters.Sync();
      const syncEvents = await pairContract.queryFilter(syncFilter, fromBlock, currentBlock);
      
      if (syncEvents.length > 0) {
        const oldestSync = syncEvents[0];
        if (oldestSync.args) {
          const reserve0 = oldestSync.args[0];
          const reserve1 = oldestSync.args[1];
          initialPrice = Number(reserve1) / Number(reserve0) *
                        (10 ** Number(decimals0)) / (10 ** Number(decimals1));
        }
      }
    } catch (e) {
      // Use current price as fallback
      initialPrice = currentPrice;
    }
    
    return { initialPrice, currentPrice };
  } catch (error) {
    console.error("Error getting historical price:", error);
    return null;
  }
}

async function getTradingVolume(
  provider: ethers.Provider,
  pairAddress: string,
  windowHours: number
): Promise<bigint> {
  try {
    const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const blocksPerHour = 720;
    const blocksToScan = Math.ceil(windowHours * blocksPerHour);
    const fromBlock = Math.max(0, currentBlock - blocksToScan);
    
    const swapFilter = pairContract.filters.Swap();
    const swaps = await pairContract.queryFilter(swapFilter, fromBlock, currentBlock);
    
    let totalVolume = BigInt(0);
    for (const swap of swaps) {
      if (swap.args) {
        const amount0In = swap.args.amount0In || BigInt(0);
        const amount1In = swap.args.amount1In || BigInt(0);
        totalVolume += amount0In + amount1In;
      }
    }
    
    return totalVolume;
  } catch (error) {
    console.error("Error getting trading volume:", error);
    return BigInt(0);
  }
}

async function calculateIL(
  provider: ethers.Provider,
  poolAddress: string,
  tokenWeights: number[],
  depositAmounts: string[],
  windowHours: number
): Promise<ILResult> {
  try {
    const pairContract = new ethers.Contract(poolAddress, PAIR_ABI, provider);
    
    // Get current reserves and token info
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
    
    // Get TVL
    const totalSupply = await pairContract.totalSupply();
    const tvlRaw = BigInt(reserves[0]) + BigInt(reserves[1]);
    const tvl = tvlRaw;
    
    // Get historical price
    const prices = await getHistoricalPrice(provider, poolAddress, windowHours);
    if (!prices) {
      return {
        IL_percent: 0,
        fee_apr_est: 0,
        volume_window: "0",
        notes: ["Could not fetch historical prices"],
      };
    }
    
    const priceRatio = prices.currentPrice / prices.initialPrice;
    const ilPercent = calculateImpermanentLoss(priceRatio);
    
    // Get trading volume
    const volume = await getTradingVolume(provider, poolAddress, windowHours);
    
    // Fee is typically 0.3% (30 bps) for Uniswap V2, 0.05% (5 bps) for V3
    // Detect by checking if pool is V3 (has tick spacing) or default to V2
    let feeBps = 30; // Default to V2
    
    try {
      // Try to detect V3 pool
      const V3_POOL_ABI = ["function fee() view returns (uint24)"];
      const v3Pool = new ethers.Contract(poolAddress, V3_POOL_ABI, provider);
      const fee = await v3Pool.fee();
      feeBps = Number(fee) / 100; // V3 fees are in basis points (e.g., 3000 = 0.3%)
    } catch {
      // Assume V2 if fee() doesn't exist
      feeBps = 30;
    }
    
    const feeAprEst = estimateFeeAPR(volume, tvl, feeBps, windowHours);
    
    const notes: string[] = [];
    if (ilPercent > 5) {
      notes.push(`High impermanent loss risk: ${ilPercent.toFixed(2)}%`);
    }
    if (feeAprEst < ilPercent) {
      notes.push(
        `Warning: Fee APR (${feeAprEst.toFixed(2)}%) may not cover IL (${ilPercent.toFixed(2)}%)`
      );
    }
    if (volume === BigInt(0)) {
      notes.push("Low trading volume detected");
    }
    
    return {
      IL_percent: ilPercent,
      fee_apr_est: feeAprEst,
      volume_window: volume.toString(),
      notes,
    };
  } catch (error) {
    console.error("Error calculating IL:", error);
    return {
      IL_percent: 0,
      fee_apr_est: 0,
      volume_window: "0",
      notes: ["Error calculating IL: " + (error as Error).message],
    };
  }
}

addEntrypoint({
  key: "estimate_il",
  description: "Compute impermanent loss and yield estimate",
  input: z.object({
    pool_address: z.string().describe("LP pool address"),
    token_weights: z.array(z.number()).describe("Token weight distribution"),
    deposit_amounts: z.array(z.string()).describe("Amount of each token"),
    window_hours: z.number().int().positive().describe("Historical window for calculation"),
  }),
  async handler({ input }) {
    try {
      const rpcUrl = process.env.RPC_URL || "https://eth.llamarpc.com";
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const result = await calculateIL(
        provider,
        input.pool_address,
        input.token_weights,
        input.deposit_amounts,
        input.window_hours
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
          IL_percent: 0,
          fee_apr_est: 0,
          volume_window: "0",
          notes: [],
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
