import { z } from "zod";

/** Pool types supported by the estimator */
export const PoolType = z.enum(["uniswap_v2", "uniswap_v3", "curve", "balancer"]);
export type PoolType = z.infer<typeof PoolType>;

/** Input schema for the IL estimator */
export const EstimateILInput = z.object({
  pool_address: z.string().describe("LP pool address"),
  token_weights: z.array(z.number().min(0).max(1)).describe("Token weight distribution"),
  deposit_amounts: z.array(z.number().positive()).describe("Amount of each token deposited"),
  window_hours: z.number().positive().default(24).describe("Historical window for calculation"),
  pool_type: PoolType.default("uniswap_v2").describe("Type of AMM pool"),
  entry_price_ratio: z.number().positive().optional().describe("Price ratio at time of deposit"),
  current_price_ratio: z.number().positive().optional().describe("Current price ratio"),
});

export type EstimateILInput = z.infer<typeof EstimateILInput>;

/** Individual token analysis */
export interface TokenAnalysis {
  token_index: number;
  weight: number;
  deposit_amount: number;
  current_value: number;
  pnl_usd: number;
}

/** Output schema for the IL estimator */
export interface EstimateILOutput {
  IL_percent: number;
  IL_usd: number;
  fee_apr_est: number;
  volume_window: number;
  break_even_price_ratio: number;
  token_analyses: TokenAnalysis[];
  pool_type: string;
  notes: string[];
}

/** Historical price point */
export interface PricePoint {
  timestamp: number;
  price_ratio: number;
  volume_24h: number;
  fees_24h: number;
  tvl: number;
}
