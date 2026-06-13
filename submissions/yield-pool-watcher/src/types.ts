import { z } from 'zod';

export const thresholdRulesSchema = z.object({
  tvl_drop_pct: z.number().min(0).max(100).default(10),
  tvl_spike_pct: z.number().min(0).max(10000).default(25),
  apy_drop_pct: z.number().min(0).max(100).default(20),
  apy_spike_pct: z.number().min(0).max(10000).default(50),
  apy_abs_change: z.number().min(0).max(100000).default(5),
  min_tvl_usd: z.number().min(0).default(0)
}).partial().default({});

export const watchInputSchema = z.object({
  protocol_ids: z.array(z.string().min(1)).default([]),
  pools: z.array(z.string().min(1)).default([]),
  threshold_rules: thresholdRulesSchema.optional(),
  limit: z.number().int().min(1).max(100).default(25),
  include_charts: z.boolean().default(true)
});

export type WatchInput = z.infer<typeof watchInputSchema>;
export type ThresholdRules = Required<z.infer<typeof thresholdRulesSchema>>;

export interface PoolMetric {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  tvl_usd: number;
  apy: number | null;
  apy_base: number | null;
  apy_reward: number | null;
  il_risk: string | null;
  exposure: string | null;
  predictions: { predicted_class?: string; predicted_probability?: number };
  underlying_tokens: string[];
  reward_tokens: string[];
  updated_at: string;
}

export interface PoolDelta {
  pool: string;
  tvl_delta_pct: number | null;
  tvl_delta_usd: number | null;
  apy_delta_pct: number | null;
  apy_delta_abs: number | null;
  previous_tvl_usd: number | null;
  previous_apy: number | null;
  source: 'defillama_chart' | 'service_memory' | 'none';
}

export interface YieldAlert {
  pool: string;
  project: string;
  chain: string;
  severity: 'info' | 'medium' | 'high' | 'critical';
  type: 'tvl_drop' | 'tvl_spike' | 'apy_drop' | 'apy_spike' | 'apy_abs_change';
  message: string;
  observed_value: number;
  threshold: number;
}

export interface WatchOutput {
  pool_metrics: PoolMetric[];
  deltas: PoolDelta[];
  alerts: YieldAlert[];
  warnings: string[];
  data_sources: string[];
  fetched_at: string;
}