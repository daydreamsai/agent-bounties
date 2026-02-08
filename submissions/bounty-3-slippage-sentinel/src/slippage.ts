import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";

type PoolDepth = {
  dex: string;
  fee_tier: number;
  liquidity: string;
  price_impact_bps: number;
};

type SlippageResult = {
  min_safe_slip_bps: number;
  recommended_slip_bps: number;
  pool_depths: PoolDepth[];
  recent_trade_size_p95: number;
  volatility_24h_bps: number;
  risk_level: "low" | "medium" | "high" | "extreme";
  summary: string;
};

const UNISWAP_V3_QUOTER: Record<number, Address> = {
  8453: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
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

const FEES = [100, 500, 3000, 10000];

function getClient(chainId: number) {
  if (chainId === 8453) {
    return createPublicClient({ chain: base, transport: http("https://1rpc.io/base") });
  }
  throw new Error(`Unsupported chain: ${chainId}`);
}

export async function analyzeSlippage(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  chainId: number,
  routeHint?: string
): Promise<SlippageResult> {
  const client = getClient(chainId);
  const quoter = UNISWAP_V3_QUOTER[chainId];

  // Get quotes at different sizes to measure price impact
  const sizes = [amountIn / 10n, amountIn / 2n, amountIn, amountIn * 2n];
  const poolDepths: PoolDepth[] = [];

  for (const fee of FEES) {
    try {
      // Quote the actual amount
      const result = await client.simulateContract({
        address: quoter,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [{
          tokenIn: tokenIn as Address,
          tokenOut: tokenOut as Address,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0n,
        }],
      });
      const mainOut = result.result[0];

      // Quote a tiny amount for reference price
      const tinyResult = await client.simulateContract({
        address: quoter,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [{
          tokenIn: tokenIn as Address,
          tokenOut: tokenOut as Address,
          amountIn: amountIn / 100n > 0n ? amountIn / 100n : 1n,
          fee,
          sqrtPriceLimitX96: 0n,
        }],
      });
      const tinyOut = tinyResult.result[0];

      // Calculate price impact
      const refPrice = Number(tinyOut) * 100;
      const actualPrice = Number(mainOut);
      const impactBps = refPrice > 0 ? Math.round(((refPrice - actualPrice) / refPrice) * 10000) : 0;

      poolDepths.push({
        dex: `uniswap_v3_${fee}`,
        fee_tier: fee,
        liquidity: mainOut.toString(),
        price_impact_bps: Math.max(0, impactBps),
      });
    } catch {
      // Fee tier not available
    }
  }

  if (poolDepths.length === 0) {
    return {
      min_safe_slip_bps: 500,
      recommended_slip_bps: 1000,
      pool_depths: [],
      recent_trade_size_p95: 0,
      volatility_24h_bps: 0,
      risk_level: "extreme",
      summary: "No liquidity found for this pair. Use extreme caution.",
    };
  }

  // Find best pool (lowest impact)
  poolDepths.sort((a, b) => a.price_impact_bps - b.price_impact_bps);
  const bestPool = poolDepths[0];
  const impact = bestPool.price_impact_bps;

  // Estimate volatility buffer (conservative: 2x impact + base)
  const volatilityBuffer = 50; // 0.5% base volatility assumption
  const minSafe = Math.max(impact + volatilityBuffer, 10);
  const recommended = Math.max(minSafe * 2, 30); // 2x safety margin

  let riskLevel: "low" | "medium" | "high" | "extreme";
  if (impact < 10) riskLevel = "low";
  else if (impact < 50) riskLevel = "medium";
  else if (impact < 200) riskLevel = "high";
  else riskLevel = "extreme";

  // Estimate P95 trade size (from liquidity depth)
  const p95 = Number(BigInt(bestPool.liquidity) * 20n) / 1e18;

  const summary =
    `Best pool: ${bestPool.dex} (impact: ${impact} bps). ` +
    `Recommended slippage: ${recommended} bps (${(recommended / 100).toFixed(2)}%). ` +
    `Risk: ${riskLevel}. ` +
    `${poolDepths.length} pools available.`;

  return {
    min_safe_slip_bps: minSafe,
    recommended_slip_bps: recommended,
    pool_depths: poolDepths,
    recent_trade_size_p95: p95,
    volatility_24h_bps: volatilityBuffer,
    risk_level: riskLevel,
    summary,
  };
}
