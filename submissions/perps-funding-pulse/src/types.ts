import { z } from 'zod';

export const venueSchema = z.enum(['hyperliquid', 'binance', 'bybit']);

export const pulseInputSchema = z.object({
  venue_ids: z.array(venueSchema).default(['hyperliquid']),
  markets: z.array(z.string().min(1)).default(['BTC', 'ETH']),
  include_raw: z.boolean().default(false)
});

export type VenueId = z.infer<typeof venueSchema>;
export type PulseInput = z.infer<typeof pulseInputSchema>;

export interface FundingMetric {
  venue: VenueId;
  market: string;
  symbol: string;
  funding_rate: number | null;
  funding_rate_bps: number | null;
  funding_interval_hours: number | null;
  next_funding_time: string | null;
  time_to_next_seconds: number | null;
  open_interest: number | null;
  open_interest_usd: number | null;
  mark_price: number | null;
  index_price: number | null;
  skew: number | null;
  skew_source: string | null;
  source_timestamp: string | null;
  data_source: string;
  raw?: unknown;
}

export interface PulseOutput {
  metrics: FundingMetric[];
  warnings: string[];
  data_sources: string[];
  calculation_evidence: PulseCalculationEvidence;
  fetched_at: string;
}

export interface PulseCalculationEvidenceCase {
  name: string;
  expected: number | string | null;
  actual: number | string | null;
  pass: boolean;
}

export interface PulseCalculationEvidence {
  case_count: number;
  pass_count: number;
  pass_rate_pct: number;
  cases: PulseCalculationEvidenceCase[];
}
