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
  previous_observed_at: string | null;
  current_observed_at: string | null;
  sample_interval_seconds: number | null;
  source: 'defillama_chart' | 'service_memory' | 'aave_v3_block_event' | 'none';
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
  source?: string;
  block_number?: number;
  transaction_hash?: string;
}

export interface BlockLevelYieldSignal {
  protocol: string;
  chain: string;
  pool: string;
  reserve: string;
  block_number: number;
  block_timestamp: string | null;
  transaction_hash: string;
  log_index: number;
  liquidity_rate_ray: string;
  liquidity_apy_pct: number;
  variable_borrow_rate_ray: string;
  variable_borrow_apy_pct: number;
  source: string;
}

export interface WatchOutput {
  pool_metrics: PoolMetric[];
  deltas: PoolDelta[];
  alerts: YieldAlert[];
  warnings: string[];
  freshness: {
    requested_at: string;
    fetched_at: string;
    pools_endpoint_latency_ms: number;
    chart_points_checked: number;
    chart_latest_at: string | null;
    chart_lag_seconds: number | null;
    block_level_precision: boolean;
    note: string;
  };
  block_level_signals: BlockLevelYieldSignal[];
  block_level_evidence: {
    enabled: boolean;
    latest_block: number | null;
    from_block: number | null;
    to_block: number | null;
    raw_log_count: number;
    decoded_signal_count: number;
    source: string;
  };
  data_sources: string[];
  fetched_at: string;
}
