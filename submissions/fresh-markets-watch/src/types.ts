import { z } from 'zod';

export const watchInputSchema = z.object({
  chain: z.string().min(1).default('base'),
  factories: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).default([]),
  window_minutes: z.number().int().min(1).max(10080).default(10),
  from_block: z.number().int().positive().optional(),
  to_block: z.union([z.number().int().positive(), z.literal('latest')]).default('latest')
});

export type WatchInput = z.infer<typeof watchInputSchema>;

export interface FreshMarket {
  pair_address: string;
  factory: string;
  protocol: string;
  event_type: 'PairCreated' | 'PoolCreated';
  chain: string;
  tokens: string[];
  fee: number | null;
  init_liquidity: null;
  top_holders: string[];
  created_at: string | null;
  block_number: number;
  transaction_hash: string;
  log_index: number;
}

export interface WatchOutput {
  markets: FreshMarket[];
  warnings: string[];
  scanned: { chain: string; from_block: number; to_block: number; factories: string[] };
  data_sources: string[];
  fetched_at: string;
}
