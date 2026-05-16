import { z } from "zod";

/** Supported perpetual DEX venues */
export const VenueId = z.enum([
  "gmx",
  "gmx_v2",
  "dydx_v4",
  "hyperliquid",
  "drift",
  "perpetual_protocol",
  "apex",
  "zeta",
  "mango_markets",
  "kwenta",
  "synthetix_v3",
]);
export type VenueId = z.infer<typeof VenueId>;

/** Input schema */
export const FundingPulseInput = z.object({
  venue_ids: z.array(VenueId).describe("Perpetuals exchanges to query"),
  markets: z.array(z.string()).describe("Specific markets/tickers to track"),
  extreme_threshold: z.number().default(0.1).describe("Funding rate threshold for alerts (> = extreme)"),
  lookback_hours: z.number().default(24).describe("Hours of historical data to include"),
});

export type FundingPulseInput = z.infer<typeof FundingPulseInput>;

/** A single funding rate data point */
export interface FundingRatePoint {
  timestamp: number;
  rate: number;        // 1h annualized rate as decimal (e.g., 0.01 = 1%)
  rate_8h?: number;    // 8h rate
  rate_annual: number; // Annualized %
  open_interest: number;
  mark_price: number;
  index_price: number;
}

/** Market-level funding data */
export interface MarketFunding {
  venue: VenueId;
  market: string;
  funding_rate: number;
  funding_rate_8h: number;
  time_to_next: number;   // minutes until next funding payment
  open_interest: number;
  skew: number;            // long/short ratio (>1 = long-heavy, <1 = short-heavy)
  mark_price: number;
  index_price: number;
  basis: number;           // mark - index spread
  rate_volatility: number; // std dev of rate over lookback
  history: FundingRatePoint[];
  is_extreme: boolean;
  alerts: string[];
}

/** Arbitrage opportunity across venues */
export interface ArbitrageOpportunity {
  base_market: string;
  long_venue: VenueId;
  long_rate: number;
  short_venue: VenueId;
  short_rate: number;
  spread_bps: number;      // funding rate spread in basis points
  estimated_apr: number;   // estimated APR from arbitrage
  hedge_ratio: number;
  notes: string[];
}

/** Output schema */
export interface FundingPulseOutput {
  timestamp: string;
  markets: MarketFunding[];
  arbitrage_opportunities: ArbitrageOpportunity[];
  extreme_rate_alerts: string[];
  summary: string;
}
