import { z } from 'zod';

export const supportedChains = ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'bsc', 'avalanche'] as const;
export type SupportedChain = typeof supportedChains[number];

export const routeHintSchema = z.object({
  chain: z.enum(supportedChains).optional(),
  dex: z.string().min(1).max(80).optional(),
  pool_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  pool_id: z.string().min(1).max(120).optional()
}).partial();

export const slippageInputSchema = z.object({
  token_in: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  token_out: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount_in: z.union([z.number().positive(), z.string().min(1)]),
  chain: z.enum(supportedChains).default('base'),
  route_hint: routeHintSchema.optional(),
  max_pools: z.number().int().min(1).max(10).default(5),
  trade_window_hours: z.number().int().min(1).max(24).default(6)
});

export type SlippageInput = z.infer<typeof slippageInputSchema>;

export interface PoolDepth {
  chain: SupportedChain;
  dex: string;
  pool_address: string;
  pool_name: string;
  reserve_usd: number;
  volume_24h_usd: number | null;
  price_change_1h_pct: number | null;
  price_change_24h_pct: number | null;
  estimated_price_impact_bps: number;
  fee_bps: number | null;
  evidence_url: string;
}

export interface TradeSample {
  tx_hash: string;
  block_number: number;
  timestamp: string;
  volume_usd: number;
  kind: string;
}

export interface SlippageOutput {
  min_safe_slip_bps: number;
  pool_depths: PoolDepth[];
  recent_trade_size_p95: number | null;
  route: {
    chain: SupportedChain;
    dex: string;
    pool_address: string;
    pool_name: string;
  } | null;
  warnings: string[];
  data_sources: string[];
}
