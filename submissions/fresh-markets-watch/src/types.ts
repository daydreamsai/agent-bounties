import { z } from 'zod';

export const watchInputSchema = z.object({
  chain: z.string().min(1).default('base'),
  factories: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).default([]),
  window_minutes: z.number().int().min(1).max(10080).default(10),
  from_block: z.number().int().positive().optional(),
  to_block: z.union([z.number().int().positive(), z.literal('latest')]).default('latest')
});

export type WatchInput = z.infer<typeof watchInputSchema>;

export interface InitLiquidityEvidence {
  source: string;
  block_number: number;
  token0: string;
  token1: string;
  reserve0_raw?: string;
  reserve1_raw?: string;
  sqrt_price_x96?: string;
  liquidity_raw?: string;
  initialized: boolean;
  note?: string;
}

export interface TopHolderEvidence {
  address: string;
  amount_raw: string;
  source: string;
}

export interface FreshMarket {
  pair_address: string;
  factory: string;
  protocol: string;
  event_type: 'PairCreated' | 'PoolCreated';
  chain: string;
  tokens: string[];
  fee: number | null;
  init_liquidity: InitLiquidityEvidence | null;
  top_holders: TopHolderEvidence[];
  top_holders_unavailable_reason?: string;
  created_at: string | null;
  block_number: number;
  transaction_hash: string;
  log_index: number;
}

export interface WatchOutput {
  markets: FreshMarket[];
  warnings: string[];
  scanned: { chain: string; from_block: number; to_block: number; factories: string[] };
  scan_evidence: {
    requested_window_minutes: number;
    requested_blocks: number;
    scanned_blocks: number;
    capped_to_provider_limit: boolean;
    latest_block: number;
    factory_count: number;
    raw_log_count: number;
    decoded_market_count: number;
    decode_failure_count: number;
    observed_false_positive_rate_pct: number;
    false_positive_control: string;
    factories: Array<{
      factory: string;
      protocol: string;
      event_type: 'PairCreated' | 'PoolCreated';
      topic: string;
      logs_returned: number;
      decoded_markets: number;
      decode_failures: number;
    }>;
  };
  data_sources: string[];
  fetched_at: string;
}
