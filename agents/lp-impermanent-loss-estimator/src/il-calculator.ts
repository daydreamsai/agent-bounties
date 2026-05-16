/**
 * Impermanent Loss Calculator
 *
 * Implements IL formulas for Uniswap V2 (constant product) and
 * Uniswap V3 (concentrated liquidity) AMMs.
 *
 * Formulas reference:
 *   V2: IL = 2*sqrt(r)/(1+r) - 1  where r = P_new / P_old
 *   V3: Leveraged IL = IL_V2 * L  where L = 1/(1 - sqrt(a))
 *        and a = P_lower / P_upper (the price range ratio)
 */

import type {
  ILParams,
  FeeAprParams,
  PriceAnalysis,
  AmmType,
} from "./types.js";

/**
 * Calculate impermanent loss for Uniswap V2 (constant product AMM).
 *
 * @param priceRatio - P_new / P_entry
 * @returns IL as a decimal (e.g., -0.02 means 2% loss)
 */
export function calcILV2(priceRatio: number): number {
  if (priceRatio <= 0) {
    return -1; // 100% loss if price goes to zero
  }

  const sqrtR = Math.sqrt(priceRatio);
  const il = (2 * sqrtR) / (1 + priceRatio) - 1;

  // IL is always ≤ 0 for LPs (you can't gain from IL, only lose)
  // Clamp to [-1, 0]
  return Math.max(-1, Math.min(0, il));
}

/**
 * Calculate the leverage factor for a Uniswap V3 concentrated position.
 *
 * @param priceLower - Lower bound of the position
 * @param priceUpper - Upper bound of the position
 * @returns Leverage factor (>= 1)
 */
export function calcV3Leverage(
  priceLower: number,
  priceUpper: number
): number {
  if (priceLower <= 0 || priceUpper <= 0 || priceLower >= priceUpper) {
    return 1; // Fallback: full-range = same as V2
  }

  const sqrtA = Math.sqrt(priceLower / priceUpper);
  const leverage = 1 / (1 - sqrtA);
  return leverage;
}

/**
 * Calculate impermanent loss for Uniswap V3 (concentrated liquidity).
 *
 * V3 IL is amplified by the concentration factor relative to V2.
 * If the current price is outside the position's range, IL is 100%.
 *
 * Note: This is a simplified model. Full V3 IL depends on tick-level
 * liquidity distribution and requires on-chain data for precision.
 * The backtest error target is < 10%.
 *
 * @param priceRatio - P_new / P_entry
 * @param priceLower - Lower bound of position
 * @param priceUpper - Upper bound of position
 * @returns IL as a decimal
 */
export function calcILV3(
  priceRatio: number,
  priceLower: number,
  priceUpper: number
): number {
  // If price moved outside range entirely, position is 100% in one token
  const currentPrice = priceRatio; // Assuming entry_price = 1 for ratio calc
  if (currentPrice <= priceLower || currentPrice >= priceUpper) {
    return -1; // Max loss — fully in one token
  }

  const baseIL = calcILV2(priceRatio);
  const leverage = calcV3Leverage(priceLower, priceUpper);

  // V3 IL = V2 IL * leverage, capped at -100%
  return Math.max(-1, baseIL * leverage);
}

/**
 * Main IL calculation dispatcher.
 */
export function calculateImpermanentLoss(params: ILParams): number {
  const { ammType, priceRatio, priceRange } = params;

  if (ammType === "uniswap_v3" && priceRange) {
    const [lower, upper] = priceRange;
    return calcILV3(priceRatio, lower, upper);
  }

  // Default to V2 calculation
  return calcILV2(priceRatio);
}

/**
 * Estimate fee APR for an LP position.
 *
 * APR = (fee_tier * volume_window / TVL) * (365 * 24 / window_hours)
 *
 * This is a simplified estimate. Real APR varies with:
 *   - Actual trade distribution within the position's range (V3)
 *   - Fee tier changes
 *   - Compounding effects
 *
 * @returns Annualized fee APR as a decimal (e.g., 0.15 = 15%)
 */
export function estimateFeeApr(params: FeeAprParams): number {
  const { feeTierBps, volumeWindow, tvlCurrent, windowHours } = params;

  if (tvlCurrent <= 0 || windowHours <= 0) {
    return 0;
  }

  // Fee rate as decimal (e.g., 30 bps = 0.003)
  const feeRate = feeTierBps / 10000;

  // LP fee share in the window: fee_rate * volume
  const feeShare = feeRate * volumeWindow;

  // Return on TVL in the window
  const returnInWindow = feeShare / tvlCurrent;

  // Annualize: (return_in_window) * (hours_per_year / window_hours)
  const hoursPerYear = 365 * 24;
  const apr = returnInWindow * (hoursPerYear / windowHours);

  return apr;
}

/**
 * Analyze the price ratio and categorize the deviation.
 */
export function analyzePriceRatio(
  currentPrice: number,
  entryPrice: number
): PriceAnalysis {
  const ratio = currentPrice / entryPrice;
  const deviationPercent = (ratio - 1) * 100;
  const absDeviation = Math.abs(deviationPercent);

  let direction: "up" | "down" | "flat";
  if (absDeviation < 0.5) {
    direction = "flat";
  } else {
    direction = deviationPercent > 0 ? "up" : "down";
  }

  let severity: "low" | "medium" | "high" | "extreme";
  if (absDeviation < 5) {
    severity = "low";
  } else if (absDeviation < 20) {
    severity = "medium";
  } else if (absDeviation < 50) {
    severity = "high";
  } else {
    severity = "extreme";
  }

  return { ratio, deviationPercent, direction, severity };
}

/**
 * Generate warnings and notes based on the analysis.
 */
export function generateNotes(
  ilPercent: number,
  feeApr: number,
  priceAnalysis: PriceAnalysis,
  ammType: AmmType
): string[] {
  const notes: string[] = [];

  // IL warnings
  if (ilPercent <= -0.5) {
    notes.push(
      `CRITICAL: Impermanent loss exceeds 50%. Position may be fully out of range (V3) or extreme price movement.`
    );
  } else if (ilPercent <= -0.2) {
    notes.push(
      `WARNING: Significant impermanent loss (${Math.abs(ilPercent * 100).toFixed(1)}%). Consider rebalancing.`
    );
  } else if (ilPercent <= -0.05) {
    notes.push(
      `Moderate impermanent loss detected (${Math.abs(ilPercent * 100).toFixed(1)}%).`
    );
  } else if (ilPercent < 0) {
    notes.push(`Minor impermanent loss (${Math.abs(ilPercent * 100).toFixed(2)}%).`);
  }

  // Fee APR notes
  if (feeApr > 1) {
    notes.push(
      `Exceptionally high fee APR (${(feeApr * 100).toFixed(1)}%). Verify volume data accuracy.`
    );
  } else if (feeApr > 0.5) {
    notes.push(`High fee APR (${(feeApr * 100).toFixed(1)}%).`);
  } else if (feeApr < 0.01) {
    notes.push(`Very low fee APR (${(feeApr * 100).toFixed(2)}%). May not justify LP risk.`);
  }

  // Price deviation notes
  if (priceAnalysis.severity === "extreme") {
    notes.push(
      `Extreme price deviation: ${priceAnalysis.deviationPercent.toFixed(1)}% ${priceAnalysis.direction}. IL risk is very high.`
    );
  } else if (priceAnalysis.severity === "high") {
    notes.push(
      `High price deviation: ${priceAnalysis.deviationPercent.toFixed(1)}% ${priceAnalysis.direction}.`
    );
  }

  // V3 specific notes
  if (ammType === "uniswap_v3") {
    notes.push(
      `Note: V3 IL estimate uses simplified concentrated liquidity model. Actual IL may vary by ±10% depending on tick-level distribution. For precise calculation, provide on-chain tick data.`
    );
  }

  // General disclaimer
  notes.push(
    `Disclaimer: Fee APR is estimated from window data and does not account for future volume changes or compounding. IL is calculated at current price snapshot.`
  );

  return notes;
}

/**
 * Calculate net P&L: fees earned minus impermanent loss.
 *
 * @param ilPercent - Impermanent loss as decimal (negative)
 * @param feeApr - Annualized fee APR as decimal
 * @param windowHours - Analysis window in hours
 * @returns Net P&L as a decimal percentage
 */
export function calcNetPnL(
  ilPercent: number,
  feeApr: number,
  windowHours: number
): number {
  // Prorate fee APR to the window
  const hoursPerYear = 365 * 24;
  const feeEarnedInWindow = feeApr * (windowHours / hoursPerYear);

  return feeEarnedInWindow + ilPercent;
}
