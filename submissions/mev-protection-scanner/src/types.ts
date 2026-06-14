import { z } from 'zod';

export const supportedChains = ['eth', 'base'] as const;
export type SupportedChain = (typeof supportedChains)[number];

export const dexes = ['uniswap-v2', 'uniswap-v3', 'sushiswap', 'curve', 'balancer', 'pancakeswap'] as const;
export type DexId = (typeof dexes)[number];

export const inputSchema = z.object({
  token_in: z.string().min(1),
  token_out: z.string().min(1),
  amount_in: z.union([z.string(), z.number()]).transform(String),
  dex: z.enum(dexes).default('uniswap-v2').optional(),
  chain: z.enum(supportedChains).default('eth').optional(),
  transaction_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  max_pending_txs: z.number().int().positive().max(200).default(20).optional()
});

export type MevInput = z.infer<typeof inputSchema>;

export type PendingTxSample = {
  hash: string;
  to: string | null;
  from: string | null;
  gas_price_gwei: number | null;
  max_fee_per_gas_gwei: number | null;
  input_prefix: string;
  value_eth: number;
};

export type MevOutput = {
  risk_score: number;
  attack_type: 'sandwich' | 'front-run' | 'back-run' | 'none';
  estimated_loss_usd: number;
  protection_suggestions: string[];
  competing_txs: number;
  gas_price_percentile: number | null;
  response_time_ms: number;
  signals: {
    pending_sample_size: number;
    pending_swap_like_txs: number;
    high_gas_competitors: number;
    fee_history_p50_gwei: number | null;
    fee_history_p90_gwei: number | null;
    user_gas_gwei: number | null;
    transaction_found: boolean;
  };
  notes: string[];
  data_sources: string[];
  confidence: number;
};
