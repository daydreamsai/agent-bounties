import {
  type EstimateILInput,
  type EstimateILOutput,
  type PricePoint,
  type TokenAnalysis,
} from "./types";

/**
 * Calculate impermanent loss for Uniswap V2 pools.
 *
 * IL formula: IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1
 * where price_ratio = current_price / entry_price
 */
export function calculateILV2(priceRatio: number): number {
  if (priceRatio <= 0) throw new Error("Price ratio must be positive");
  const sqrtR = Math.sqrt(priceRatio);
  return (2 * sqrtR) / (1 + priceRatio) - 1;
}

/**
 * Calculate impermanent loss for Uniswap V3 concentrated liquidity positions.
 *
 * V3 IL is more complex as it depends on the tick range.
 * For ranges fully within the current price, IL can exceed V2.
 *
 * @param priceRatio - current_price / entry_price
 * @param tickLower - lower tick of position (as price ratio from entry)
 * @param tickUpper - upper tick of position (as price ratio from entry)
 */
export function calculateILV3(
  priceRatio: number,
  tickLower: number,
  tickUpper: number
): number {
  if (priceRatio <= 0 || tickLower <= 0 || tickUpper <= tickLower) {
    throw new Error("Invalid V3 position parameters");
  }

  // If current price is outside range, position is 100% in one token
  if (priceRatio <= tickLower || priceRatio >= tickUpper) {
    // One-sided: calculate as 100% in a single asset
    return priceRatio >= tickUpper
      ? priceRatio / tickUpper - 1
      : tickLower / priceRatio - 1;
  }

  // In-range: use concentrated liquidity formula
  const sqrtP = Math.sqrt(priceRatio);
  const sqrtLower = Math.sqrt(tickLower);
  const sqrtUpper = Math.sqrt(tickUpper);

  const virtualLiquidity =
    1 / (1 / sqrtP - 1 / sqrtUpper + sqrtP - sqrtLower);

  const holdValue = Math.sqrt(priceRatio);
  const lpValue = virtualLiquidity * (2 * sqrtP - sqrtLower - sqrtUpper) +
    (sqrtUpper - sqrtP) / (sqrtUpper * sqrtP) * sqrtUpper +
    (sqrtP - sqrtLower) * sqrtLower;

  return lpValue / holdValue - 1;
}

/**
 * Calculate weighted impermanent loss for multi-token pools.
 */
export function calculateWeightedIL(
  priceRatios: number[],
  weights: number[]
): number {
  if (priceRatios.length !== weights.length) {
    throw new Error("Price ratios and weights must have the same length");
  }

  let totalIL = 0;
  let totalWeight = 0;

  for (let i = 0; i < priceRatios.length; i++) {
    totalIL += calculateILV2(priceRatios[i]) * weights[i];
    totalWeight += weights[i];
  }

  return totalIL / totalWeight;
}

/**
 * Estimate fee APR from historical volume and fee data.
 */
export function estimateFeeAPR(
  volume24h: number,
  fees24h: number,
  tvl: number,
  poolType: string
): number {
  if (tvl <= 0) return 0;

  // Base fee tier rates
  const feeTiers: Record<string, number> = {
    uniswap_v2: 0.003,      // 0.3%
    uniswap_v3_005: 0.0005, // 0.05%
    uniswap_v3_03: 0.003,   // 0.3%
    uniswap_v3_1: 0.01,     // 1%
    curve: 0.0004,          // 0.04%
    balancer: 0.003,        // 0.3% (varies)
  };

  const feeRate = feeTiers[poolType] || 0.003;

  // APR = (daily fees * 365) / TVL
  const dailyFees = fees24h > 0 ? fees24h : volume24h * feeRate;
  const annualizedFees = dailyFees * 365;
  return (annualizedFees / tvl) * 100;
}

/**
 * Calculate break-even price ratio where IL = earned fees.
 *
 * For V2: solve 2*sqrt(r)/(1+r) - 1 + feeAPR*years = 0
 */
export function calculateBreakEvenPriceRatio(
  feeAPR: number,
  holdingPeriodYears: number = 1
): { lower: number; upper: number } {
  // IL = |2*sqrt(r)/(1+r) - 1|
  // We want: IL = feeAPR * holdingPeriod
  const targetIL = feeAPR / 100 * holdingPeriodYears;

  // Binary search for the two price ratios where IL = targetIL
  // One below 1.0 (price went down), one above 1.0 (price went up)

  function ilAt(r: number): number {
    return Math.abs(calculateILV2(r));
  }

  // Find upper bound (r > 1)
  let upperLow = 1.0;
  let upperHigh = 10.0;
  for (let i = 0; i < 50; i++) {
    const mid = (upperLow + upperHigh) / 2;
    if (ilAt(mid) < targetIL) upperLow = mid;
    else upperHigh = mid;
  }
  const upper = (upperLow + upperHigh) / 2;

  // Find lower bound (r < 1)
  let lowerLow = 0.1;
  let lowerHigh = 1.0;
  for (let i = 0; i < 50; i++) {
    const mid = (lowerLow + lowerHigh) / 2;
    if (ilAt(mid) < targetIL) lowerHigh = mid;
    else lowerLow = mid;
  }
  const lower = (lowerLow + lowerHigh) / 2;

  return { lower: Math.round(lower * 10000) / 10000, upper: Math.round(upper * 10000) / 10000 };
}

/**
 * Analyze individual token positions within the LP.
 */
export function analyzeTokens(
  depositAmounts: number[],
  weights: number[],
  priceRatios: number[]
): TokenAnalysis[] {
  return depositAmounts.map((amount, i) => {
    const weight = weights[i] || 1 / depositAmounts.length;
    const currentValue = amount * (priceRatios[i] || 1);
    return {
      token_index: i,
      weight,
      deposit_amount: amount,
      current_value: currentValue,
      pnl_usd: currentValue - amount,
    };
  });
}

/**
 * Generate notes and warnings based on the analysis.
 */
export function generateNotes(
  ilPercent: number,
  feeAPR: number,
  volume24h: number,
  priceRatio: number
): string[] {
  const notes: string[] = [];

  if (ilPercent < -20) {
    notes.push("WARNING: Severe impermanent loss (>20%). Fees may not compensate.");
  } else if (ilPercent < -5) {
    notes.push("Significant impermanent loss detected. Monitor closely.");
  }

  if (feeAPR > 50) {
    notes.push("HIGH FEE APR: Pool has unusually high fee generation.");
  }

  if (volume24h === 0) {
    notes.push("No volume data in window. Fee estimates are based on pool type defaults.");
  }

  if (Math.abs(priceRatio - 1) > 0.5) {
    notes.push(
      `Large price divergence detected (${((priceRatio - 1) * 100).toFixed(1)}%). IL risk is elevated.`
    );
  }

  if (feeAPR > Math.abs(ilPercent) * 100) {
    notes.push("Fee APR exceeds IL loss — position is net profitable.");
  } else if (feeAPR > 0) {
    const monthsToBE = Math.abs(ilPercent) / (feeAPR / 100) * 12;
    notes.push(
      `Estimated ${monthsToBE.toFixed(1)} months to break even at current fee rate.`
    );
  }

  return notes;
}

/**
 * Main estimation function — orchestrates the full IL and fee calculation.
 */
export async function estimateImpermanentLoss(
  input: EstimateILInput
): Promise<EstimateILOutput> {
  const {
    pool_type,
    deposit_amounts,
    token_weights,
    window_hours,
    entry_price_ratio,
    current_price_ratio,
  } = input;

  // Use provided ratios or default to 1.0
  const entryRatio = entry_price_ratio || 1.0;
  const currentRatio = current_price_ratio || 1.0;
  const priceRatio = currentRatio / entryRatio;

  // Calculate IL based on pool type
  let ilPercent: number;
  if (pool_type === "uniswap_v3") {
    ilPercent = calculateILV3(priceRatio, 0.8, 1.2);
  } else if (pool_type === "curve" || pool_type === "balancer") {
    ilPercent = calculateWeightedIL(
      deposit_amounts.map(() => priceRatio),
      token_weights
    );
  } else {
    ilPercent = calculateILV2(priceRatio);
  }

  // Calculate IL in USD
  const totalDeposit = deposit_amounts.reduce((sum, a) => sum + a, 0);
  const ilUSD = totalDeposit * ilPercent;

  // Estimate fee APR (placeholder — would query DEX subgraph in production)
  const mockVolume = 1_000_000 * (window_hours / 24);
  const mockFees = mockVolume * (pool_type.includes("v3") ? 0.001 : 0.003);
  const mockTVL = totalDeposit * 10;
  const feeAPR = estimateFeeAPR(mockVolume, mockFees, mockTVL, pool_type);

  // Analyze individual tokens
  const tokenAnalyses = analyzeTokens(deposit_amounts, token_weights, [
    priceRatio,
    1 / priceRatio,
  ]);

  // Calculate break-even
  const breakEven = calculateBreakEvenPriceRatio(feeAPR);

  // Generate notes
  const notes = generateNotes(ilPercent, feeAPR, mockVolume, priceRatio);

  return {
    IL_percent: Math.round(ilPercent * 10000) / 100,
    IL_usd: Math.round(ilUSD * 100) / 100,
    fee_apr_est: Math.round(feeAPR * 100) / 100,
    volume_window: mockVolume,
    break_even_price_ratio: breakEven.upper,
    token_analyses: tokenAnalyses,
    pool_type,
    notes,
  };
}
