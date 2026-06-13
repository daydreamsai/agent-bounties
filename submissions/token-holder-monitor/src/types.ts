import { z } from 'zod';

export const supportedChains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'] as const;
export type SupportedChain = (typeof supportedChains)[number];

export const monitorInputSchema = z.object({
  contract_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'contract_address must be an EVM address'),
  chain: z.enum(supportedChains),
  min_holders: z.number().int().positive().max(1000).default(100).optional(),
  lookback_blocks: z.number().int().positive().max(1_000_000).default(120_000).optional(),
  top_n: z.number().int().positive().max(100).default(25).optional(),
  large_transfer_threshold_bps: z.number().int().positive().max(10_000).default(50).optional()
});

export type MonitorInput = z.infer<typeof monitorInputSchema>;
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type WhaleWallet = {
  address: string;
  balance_raw: string;
  balance_display?: string;
  share_bps?: number;
  transfer_count_observed: number;
};

export type ConcentrationMetrics = {
  gini_coefficient: number;
  hhi_index: number;
  top_1_share_bps: number;
  top_5_share_bps: number;
  top_10_share_bps: number;
  top_100_share_bps: number;
  sample_balance_coverage_bps?: number;
};

export type HolderAlert = {
  severity: RiskLevel;
  type: string;
  message: string;
  evidence: Record<string, unknown>;
};

export type LargeTransfer = {
  transaction_hash?: string;
  block_number: string;
  from: string;
  to: string;
  amount_raw: string;
  amount_display?: string;
  amount_supply_bps?: number;
};

export type ExternalCheck = {
  provider: 'rpc' | 'etherscan-v2';
  status: 'ok' | 'unavailable' | 'error';
  evidence?: Record<string, unknown>;
  error?: string;
};

export type TokenInfo = {
  chain: SupportedChain;
  chain_id: number;
  contract_address: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  total_supply_raw?: string;
  total_supply_display?: string;
};

export type MonitorOutput = {
  holder_count: number;
  holder_count_is_sampled: boolean;
  whale_wallets: WhaleWallet[];
  concentration_metrics: ConcentrationMetrics;
  centralization_risk: RiskLevel;
  alerts: HolderAlert[];
  large_transfers: LargeTransfer[];
  token_info: TokenInfo;
  external_checks: ExternalCheck[];
  data_sources: string[];
  warnings: string[];
  generated_at: string;
  scan_window: {
    from_block: string;
    to_block: string;
    lookback_blocks: number;
  };
};
