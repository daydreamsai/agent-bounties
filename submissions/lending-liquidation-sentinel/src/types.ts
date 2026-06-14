import { z } from 'zod';
import type { LiquidationCalculationEvidence } from './aave.js';

export const positionSchema = z.object({
  protocol_id: z.string().optional(),
  collateral_symbol: z.string().optional(),
  debt_symbol: z.string().optional(),
  collateral_amount: z.number().positive().optional(),
  debt_amount: z.number().positive().optional(),
  collateral_price_usd: z.number().positive().optional(),
  debt_price_usd: z.number().positive().optional(),
  liquidation_threshold: z.number().positive().max(1).optional()
});

export const sentinelInputSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  protocol_ids: z.array(z.string().min(1)).default(['aave-v3-base']),
  positions: z.array(positionSchema).default([]),
  alert_threshold: z.number().positive().default(1.2)
});

export type SentinelInput = z.infer<typeof sentinelInputSchema>;
export type PositionInput = z.infer<typeof positionSchema>;

export interface LendingPositionRisk {
  protocol_id: string;
  chain: string;
  health_factor: number | null;
  liq_price: number | null;
  buffer_percent: number | null;
  alert_threshold_hit: boolean;
  total_collateral_usd: number;
  total_debt_usd: number;
  available_borrow_usd: number;
  current_liquidation_threshold_bps: number;
  ltv_bps: number;
  data_source: string;
  notes: string[];
}

export interface SentinelOutput {
  positions: LendingPositionRisk[];
  warnings: string[];
  data_sources: string[];
  calculation_evidence: LiquidationCalculationEvidence;
  fetched_at: string;
}
