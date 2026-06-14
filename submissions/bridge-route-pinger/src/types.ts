import { z } from 'zod';

export const bridgeInputSchema = z.object({
  token: z.string().min(1).default('ETH'),
  amount: z.union([z.string().min(1), z.number().positive()]).default('0.001'),
  from_chain: z.string().min(1).default('base'),
  to_chain: z.string().min(1).default('optimism'),
  from_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default('0x0000000000000000000000000000000000000001'),
  slippage: z.number().min(0).max(0.5).default(0.005)
});

export type BridgeInput = z.infer<typeof bridgeInputSchema>;

export interface BridgeRoute {
  route_id: string;
  tool: string;
  bridge: string;
  from_chain: string;
  to_chain: string;
  from_token: string;
  to_token: string;
  from_amount: string;
  to_amount: string | null;
  to_amount_min: string | null;
  from_amount_usd: number | null;
  to_amount_usd: number | null;
  eta_minutes: number | null;
  fee_usd: number;
  gas_fee_usd: number;
  bridge_fee_usd: number;
  requirements: string[];
  included_steps: string[];
  data_source: string;
}

export interface BridgeOutput {
  routes: BridgeRoute[];
  best_route: BridgeRoute | null;
  warnings: string[];
  data_sources: string[];
  calculation_evidence: BridgeCalculationEvidence;
  fetched_at: string;
}

export interface BridgeCalculationEvidenceCase {
  name: string;
  expected_best_route_id: string | null;
  actual_best_route_id: string | null;
  expected_fee_usd: number | null;
  actual_fee_usd: number | null;
  expected_eta_minutes: number | null;
  actual_eta_minutes: number | null;
  pass: boolean;
}

export interface BridgeCalculationEvidence {
  case_count: number;
  pass_count: number;
  pass_rate_pct: number;
  cases: BridgeCalculationEvidenceCase[];
}
