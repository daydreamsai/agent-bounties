import { z } from 'zod';

export const supportedChains = ['base', 'eth'] as const;
export type SupportedChain = (typeof supportedChains)[number];

export const inputSchema = z.object({
  token_in: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'token_in must be an EVM token address'),
  token_out: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'token_out must be an EVM token address'),
  amount_in: z.union([z.string(), z.number()]).transform(String),
  chains: z.array(z.enum(supportedChains)).min(1).default(['base']).optional(),
  threshold_bps: z.number().default(0).optional(),
  max_routes: z.number().int().positive().max(20).default(10).optional()
});

export type ArbInput = z.infer<typeof inputSchema>;

export type DexConfig = {
  id: string;
  name: string;
  chain: SupportedChain;
  factory: string;
  router?: string;
  feeBps: number;
  swapGasUnits: number;
};

export type QuoteRoute = {
  chain: SupportedChain;
  dex: string;
  factory: string;
  pair: string;
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  amount_out_decimal: number;
  fee_bps: number;
  gas_cost_usd: number | null;
  gas_cost_token_out: number | null;
  est_fill_cost: number;
  net_output_after_cost: number;
  quote_block: string;
  quote_source: string;
  router?: string;
  router_amount_out?: string;
  router_quote_error_pct?: number | null;
  reserve_in?: string;
  reserve_out?: string;
  decimals_in?: number;
  decimals_out?: number;
};

export type ArbOpportunity = {
  buy_route: QuoteRoute;
  sell_route: QuoteRoute;
  gross_spread_bps: number;
  net_spread_bps: number;
  est_fill_cost: number;
  profit_token_out: number;
  roundtrip_profit_token_in: number | null;
  notes: string[];
};

export type ArbCalculationEvidenceCase = {
  name: string;
  threshold_bps: number;
  expected_opportunity_count: number;
  actual_opportunity_count: number;
  expected_best_route: boolean;
  actual_best_route: boolean;
  roundtrip_profit_token_in: number | null;
  pass: boolean;
};

export type ArbCalculationEvidence = {
  case_count: number;
  pass_count: number;
  pass_rate_pct: number;
  cases: ArbCalculationEvidenceCase[];
};

export type ArbOutput = {
  token_in: string;
  token_out: string;
  amount_in: string;
  chains: SupportedChain[];
  best_route: ArbOpportunity | null;
  alt_routes: ArbOpportunity[];
  net_spread_bps: number | null;
  est_fill_cost: number | null;
  quotes: QuoteRoute[];
  warnings: string[];
  data_sources: string[];
  calculation_evidence: ArbCalculationEvidence;
  confidence: number;
};
