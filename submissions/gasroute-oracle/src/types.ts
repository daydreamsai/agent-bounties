import { z } from 'zod';

export const supportedChains = ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche'] as const;
export type SupportedChain = typeof supportedChains[number];

export const gasRouteInputSchema = z.object({
  chain_set: z.array(z.enum(supportedChains)).min(1).max(supportedChains.length),
  calldata_size_bytes: z.number().int().min(0).max(500000),
  gas_units_est: z.number().int().min(21000).max(50000000)
});

export type GasRouteInput = z.infer<typeof gasRouteInputSchema>;

export type BusyLevel = 'low' | 'medium' | 'high' | 'congested' | 'unknown';

export interface ChainGasQuote {
  chain: SupportedChain;
  chain_id: number;
  native_symbol: string;
  fee_native: string;
  fee_usd: number | null;
  busy_level: BusyLevel;
  tip_hint: string;
  base_fee_gwei: number | null;
  priority_fee_gwei: number | null;
  gas_price_gwei: number;
  gas_units_est: number;
  calldata_size_bytes: number;
  calldata_gas_units: number;
  total_gas_units: number;
  native_price_usd: number | null;
  block_number: string | null;
  evidence: {
    rpc_url_host: string;
    method: 'feeHistory' | 'gasPrice';
    gas_used_ratio?: number[];
    fetched_at: string;
  };
}

export interface GasRouteCalculationEvidenceCase {
  name: string;
  expected: number | string;
  actual: number | string;
  gas_error_pct: number | null;
  pass: boolean;
}

export interface GasRouteCalculationEvidence {
  case_count: number;
  pass_count: number;
  pass_rate_pct: number;
  max_gas_error_pct: number;
  cases: GasRouteCalculationEvidenceCase[];
}

export interface GasRouteOutput {
  chain: SupportedChain;
  fee_native: string;
  fee_usd: number | null;
  busy_level: BusyLevel;
  tip_hint: string;
  quotes: ChainGasQuote[];
  warnings: string[];
  data_sources: string[];
  calculation_evidence: GasRouteCalculationEvidence;
}
