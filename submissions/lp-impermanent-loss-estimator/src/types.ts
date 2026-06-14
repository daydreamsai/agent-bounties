import { z } from 'zod';
import type { IlBacktestSummary } from './math.js';

export const supportedNetworks = [
  'eth',
  'base',
  'polygon_pos',
  'arbitrum',
  'optimism',
  'bsc',
  'avalanche',
  'gnosis',
  'fantom'
] as const;

export type SupportedNetwork = (typeof supportedNetworks)[number];

export const inputSchema = z.object({
  pool_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'pool_address must be an EVM pool address'),
  network: z.enum(supportedNetworks).default('base').optional(),
  token_weights: z.array(z.number().positive()).min(2).default([0.5, 0.5]).optional(),
  deposit_amounts: z.array(z.number().nonnegative()).min(2),
  window_hours: z.number().positive().max(24 * 30).default(24).optional(),
  fee_bps: z.number().nonnegative().max(10_000).optional()
});

export type LpIlInput = z.infer<typeof inputSchema>;

export type LpIlOutput = {
  pool_address: string;
  network: SupportedNetwork;
  token_weights: number[];
  deposit_amounts: number[];
  window_hours: number;
  IL_percent: number;
  fee_apr_est: number | null;
  volume_window: number | null;
  tvl_usd: number | null;
  net_apr_after_il_est: number | null;
  price_ratio_start: number | null;
  price_ratio_end: number | null;
  fee_bps_used: number;
  notes: string[];
  data_sources: string[];
  backtest_summary: IlBacktestSummary;
  confidence: number;
};

export type PoolSnapshot = {
  poolName?: string;
  reserveUsd: number | null;
  volumeWindows: Record<string, number | undefined>;
  baseTokenPriceUsd: number | null;
  quoteTokenPriceUsd: number | null;
  feeBps: number | null;
};

export type OhlcvPoint = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
};
