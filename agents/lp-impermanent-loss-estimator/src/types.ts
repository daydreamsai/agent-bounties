/**
 * Types for the LP Impermanent Loss Estimator agent.
 */

/** Supported AMM types */
export type AmmType = "uniswap_v2" | "uniswap_v3";

/** Token weight distribution */
export type TokenWeights = [number, number];

/** Deposit amounts for each token */
export type DepositAmounts = [string, string];

/**
 * Input schema for the estimate entrypoint.
 */
export interface EstimateInput {
  pool_address: string;
  amm_type?: AmmType;
  token_weights?: TokenWeights;
  deposit_amounts: DepositAmounts;
  window_hours?: number;
  /** Uniswap V3 specific: price range as [lower, upper] tick */
  price_range?: [number, number];
  /** Current price of token0 in terms of token1 */
  current_price?: number;
  /** Entry price at time of deposit */
  entry_price?: number;
  /** Current pool fee tier in basis points (e.g. 30 = 0.3%) */
  fee_tier_bps?: number;
  /** Pool TVL at entry */
  tvl_entry?: number;
  /** Current pool TVL */
  tvl_current?: number;
  /** Trading volume in the window (USD) */
  volume_window?: number;
}

/**
 * Output schema for the estimate entrypoint.
 */
export interface EstimateOutput {
  /** Impermanent loss as a percentage (e.g. 2.5 = 2.5% loss) */
  il_percent: number;
  /** Estimated APR from fees (annualized percentage) */
  fee_apr_est: number;
  /** Trading volume in the analysis window (USD) */
  volume_window: number;
  /** Price ratio (current / entry) */
  price_ratio: number;
  /** Net P&L including IL and fees (percentage) */
  net_pnl_percent: number;
  /** Whether position is in profit (before IL) */
  position_in_profit: boolean;
  /** Additional context and warnings */
  notes: string[];
}

/**
 * Parameters for impermanent loss calculation.
 */
export interface ILParams {
  ammType: AmmType;
  priceRatio: number;
  tokenWeights?: TokenWeights;
  priceRange?: [number, number];
}

/**
 * Fee APR estimation parameters.
 */
export interface FeeAprParams {
  feeTierBps: number;
  volumeWindow: number;
  tvlCurrent: number;
  windowHours: number;
}

/**
 * Price ratio analysis result.
 */
export interface PriceAnalysis {
  ratio: number;
  deviationPercent: number;
  direction: "up" | "down" | "flat";
  severity: "low" | "medium" | "high" | "extreme";
}
