import {
  createPublicClient,
  http,
  type Address,
  parseAbiItem,
} from "viem";
import { base } from "viem/chains";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";

const UNISWAP_V3_QUOTER_V2: Address =
  "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";

const UNISWAP_V3_FACTORY: Address =
  "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";

const FEE_TIERS: readonly number[] = [100, 500, 3000, 10000] as const;

const SWAP_EVENT_LOOKBACK_BLOCKS = 100n;

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------

const quoterAbi = [
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

const factoryAbi = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

const poolLiquidityAbi = [
  {
    name: "liquidity",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
  },
] as const;

const swapEventAbi = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyzeInput {
  token_in: string;
  token_out: string;
  amount_in: string;
  route_hint?: string;
}

export interface PoolDepth {
  fee_tier: number;
  liquidity: string;
  price_impact_bps: number;
}

export interface AnalyzeOutput {
  min_safe_slip_bps: number;
  recommended_slip_bps: number;
  pool_depths: PoolDepth[];
  recent_trade_size_p95: string;
  risk_level: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function getClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_RPC),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

function isZeroAddress(addr: Address): boolean {
  return addr === ZERO_ADDRESS;
}

/**
 * Quote exact input single via the Uniswap V3 Quoter V2.
 * Uses `simulateContract` because the quoter mutates state internally.
 * Returns the `amountOut` or null if the pool doesn't exist / reverts.
 */
async function quoteExactInputSingle(
  client: ReturnType<typeof getClient>,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: number
): Promise<bigint | null> {
  try {
    const { result } = await client.simulateContract({
      address: UNISWAP_V3_QUOTER_V2,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
    // result is a tuple: [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
    return result[0];
  } catch {
    return null;
  }
}

/**
 * Fetch the pool address for a given pair + fee tier from the Factory.
 */
async function getPoolAddress(
  client: ReturnType<typeof getClient>,
  tokenA: Address,
  tokenB: Address,
  fee: number
): Promise<Address | null> {
  try {
    const pool = await client.readContract({
      address: UNISWAP_V3_FACTORY,
      abi: factoryAbi,
      functionName: "getPool",
      args: [tokenA, tokenB, fee],
    });
    if (isZeroAddress(pool)) return null;
    return pool;
  } catch {
    return null;
  }
}

/**
 * Read current liquidity from a Uniswap V3 pool.
 */
async function getPoolLiquidity(
  client: ReturnType<typeof getClient>,
  poolAddress: Address
): Promise<bigint> {
  try {
    return await client.readContract({
      address: poolAddress,
      abi: poolLiquidityAbi,
      functionName: "liquidity",
    });
  } catch {
    return 0n;
  }
}

/**
 * Fetch recent Swap events from a pool and return the absolute amount0
 * values (trade sizes in token0 terms).
 */
async function getRecentSwapSizes(
  client: ReturnType<typeof getClient>,
  poolAddress: Address
): Promise<bigint[]> {
  try {
    const blockNumber = await client.getBlockNumber();
    const fromBlock =
      blockNumber > SWAP_EVENT_LOOKBACK_BLOCKS
        ? blockNumber - SWAP_EVENT_LOOKBACK_BLOCKS
        : 0n;

    const logs = await client.getLogs({
      address: poolAddress,
      event: swapEventAbi,
      fromBlock,
      toBlock: "latest",
    });

    return logs.map((log) => {
      const amount0 = log.args.amount0 ?? 0n;
      return amount0 < 0n ? -amount0 : amount0;
    });
  } catch {
    return [];
  }
}

/**
 * Calculate the P95 value from an array of bigints.
 */
function percentile95(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const idx = Math.min(
    Math.ceil(sorted.length * 0.95) - 1,
    sorted.length - 1
  );
  return sorted[idx];
}

/**
 * Calculate the standard deviation of bigint values (returns number for BPS math).
 */
function stdDevBps(impactValues: number[]): number {
  if (impactValues.length < 2) return 0;
  const mean = impactValues.reduce((a, b) => a + b, 0) / impactValues.length;
  const variance =
    impactValues.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
    (impactValues.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate price impact in basis points between a small reference trade
 * and the actual trade size.
 *
 * Price impact = ((refRate - fullRate) / refRate) * 10000
 * where rate = amountOut / amountIn
 *
 * If the small quote or full quote is zero/null, returns null.
 */
function calcPriceImpactBps(
  refAmountIn: bigint,
  refAmountOut: bigint,
  fullAmountIn: bigint,
  fullAmountOut: bigint
): number | null {
  if (
    refAmountIn === 0n ||
    fullAmountIn === 0n ||
    refAmountOut === 0n ||
    fullAmountOut === 0n
  ) {
    return null;
  }

  // Use cross-multiplication to avoid floating-point loss:
  // refRate = refAmountOut / refAmountIn
  // fullRate = fullAmountOut / fullAmountIn
  // impact = (refRate - fullRate) / refRate
  //        = 1 - (fullAmountOut * refAmountIn) / (refAmountOut * fullAmountIn)
  // In BPS (x 10000):
  //        = 10000 - (fullAmountOut * refAmountIn * 10000) / (refAmountOut * fullAmountIn)

  const numerator = fullAmountOut * refAmountIn * 10000n;
  const denominator = refAmountOut * fullAmountIn;

  if (denominator === 0n) return null;

  const ratioBps = Number(numerator / denominator);
  const impactBps = 10000 - ratioBps;

  // Impact can be negative in unusual cases (positive slippage); clamp to 0.
  return Math.max(0, impactBps);
}

/**
 * Classify risk level based on recommended slippage in BPS.
 */
function classifyRisk(bps: number): string {
  if (bps < 100) return "low";
  if (bps < 300) return "medium";
  if (bps < 500) return "high";
  return "extreme";
}

// ---------------------------------------------------------------------------
// Main analysis
// ---------------------------------------------------------------------------

export async function analyzeSlippage(
  input: AnalyzeInput
): Promise<AnalyzeOutput> {
  const client = getClient();

  const tokenIn = input.token_in as Address;
  const tokenOut = input.token_out as Address;

  let fullAmount: bigint;
  try {
    fullAmount = BigInt(input.amount_in);
  } catch {
    throw new Error(`Invalid amount_in: "${input.amount_in}" is not a valid integer`);
  }

  if (fullAmount <= 0n) {
    throw new Error(`amount_in must be positive, got ${input.amount_in}`);
  }

  // Reference (small) trade amount: 10% of full amount, minimum 1.
  const refAmount = fullAmount / 10n || 1n;

  // Probe amounts for price-impact curve analysis.
  const probeAmounts = [
    { label: "10%", amount: fullAmount / 10n || 1n },
    { label: "50%", amount: fullAmount / 2n || 1n },
    { label: "100%", amount: fullAmount },
    { label: "200%", amount: fullAmount * 2n },
  ];

  const poolDepths: PoolDepth[] = [];
  const allImpactBps: number[] = [];
  let allSwapSizes: bigint[] = [];

  // Process each fee tier concurrently.
  const tierResults = await Promise.allSettled(
    FEE_TIERS.map(async (fee) => {
      // 1. Check if pool exists.
      const poolAddr = await getPoolAddress(client, tokenIn, tokenOut, fee);
      if (!poolAddr) return null;

      // 2. Get pool liquidity.
      const liquidity = await getPoolLiquidity(client, poolAddr);

      // 3. Get reference quote (small trade) for price-impact baseline.
      const refOut = await quoteExactInputSingle(
        client,
        tokenIn,
        tokenOut,
        refAmount,
        fee
      );
      if (refOut === null) return null;

      // 4. Get full-amount quote.
      const fullOut = await quoteExactInputSingle(
        client,
        tokenIn,
        tokenOut,
        fullAmount,
        fee
      );
      if (fullOut === null) return null;

      // 5. Calculate price impact for the full trade.
      const impactBps = calcPriceImpactBps(
        refAmount,
        refOut,
        fullAmount,
        fullOut
      );

      // 6. Probe additional amounts to build an impact curve and measure variance.
      const probeImpacts: number[] = [];
      for (const probe of probeAmounts) {
        if (probe.amount === fullAmount) {
          // Already have this.
          if (impactBps !== null) probeImpacts.push(impactBps);
          continue;
        }
        const probeOut = await quoteExactInputSingle(
          client,
          tokenIn,
          tokenOut,
          probe.amount,
          fee
        );
        if (probeOut !== null) {
          const probeImpact = calcPriceImpactBps(
            refAmount,
            refOut,
            probe.amount,
            probeOut
          );
          if (probeImpact !== null) probeImpacts.push(probeImpact);
        }
      }

      // 7. Fetch recent swap events for P95 trade size.
      const swapSizes = await getRecentSwapSizes(client, poolAddr);

      return {
        fee,
        liquidity,
        impactBps: impactBps ?? 0,
        probeImpacts,
        swapSizes,
      };
    })
  );

  // Aggregate results from all fee tiers.
  for (const result of tierResults) {
    if (result.status !== "fulfilled" || result.value === null) continue;
    const { fee, liquidity, impactBps, probeImpacts, swapSizes } =
      result.value;

    poolDepths.push({
      fee_tier: fee,
      liquidity: liquidity.toString(),
      price_impact_bps: impactBps,
    });

    // probeImpacts already includes the full-amount impact (added when
    // probe.amount === fullAmount), so only spread probeImpacts to avoid
    // double-counting the full-trade data point in the stdDev calculation.
    allImpactBps.push(...probeImpacts);
    allSwapSizes.push(...swapSizes);
  }

  // ---------------------------------------------------------------------------
  // No pools found -- return conservative defaults.
  // ---------------------------------------------------------------------------
  if (poolDepths.length === 0) {
    return {
      min_safe_slip_bps: 500,
      recommended_slip_bps: 500,
      pool_depths: [],
      recent_trade_size_p95: "0",
      risk_level: "extreme",
    };
  }

  // ---------------------------------------------------------------------------
  // Calculate slippage recommendation.
  // ---------------------------------------------------------------------------

  // Max observed price impact across all tiers at the requested trade size.
  const maxImpact = Math.max(...poolDepths.map((p) => p.price_impact_bps));

  // Volatility buffer derived from the standard deviation of all probed impacts.
  const volatilityBuffer =
    allImpactBps.length >= 2 ? stdDevBps(allImpactBps) : maxImpact * 0.2;

  // Trade-size variance buffer: if recent on-chain trades are much smaller
  // than the requested amount, add extra padding.
  const p95 = percentile95(allSwapSizes);
  let sizeBuffer = 0;
  if (p95 > 0n && fullAmount > p95) {
    // The requested trade is larger than 95% of recent trades -- high impact risk.
    const ratio = Number((fullAmount * 100n) / p95) / 100;
    sizeBuffer = Math.min(ratio * 10, 200); // Up to 200 bps extra.
  }

  const minSafeSlipBps = Math.ceil(
    maxImpact + volatilityBuffer + sizeBuffer
  );

  // Recommended = 1.5x minimum with a floor of 50 bps.
  const recommendedSlipBps = Math.max(
    50,
    Math.ceil(minSafeSlipBps * 1.5)
  );

  const riskLevel = classifyRisk(recommendedSlipBps);

  return {
    min_safe_slip_bps: minSafeSlipBps,
    recommended_slip_bps: recommendedSlipBps,
    pool_depths: poolDepths,
    recent_trade_size_p95: p95.toString(),
    risk_level: riskLevel,
  };
}
