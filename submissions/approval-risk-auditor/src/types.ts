import { z } from 'zod';

export const supportedChains = [
  'ethereum',
  'base',
  'polygon',
  'arbitrum',
  'optimism',
  'bsc',
  'avalanche',
  'gnosis',
  'fantom'
] as const;
export type SupportedChain = (typeof supportedChains)[number];

export const auditInputSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'wallet must be an EVM address'),
  chains: z.array(z.enum(supportedChains)).min(1),
  stale_days: z.number().int().positive().default(90).optional(),
  from_block: z.record(z.enum(supportedChains), z.number().int().nonnegative()).optional(),
  token_addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).default([]).optional()
});

export type AuditInput = z.infer<typeof auditInputSchema>;

export type ApprovalStandard = 'erc20' | 'erc721_token' | 'erc721_operator' | 'erc1155_operator' | 'erc721_or_erc1155_operator';

export type RiskFlag =
  | 'unlimited_allowance'
  | 'max_uint_allowance'
  | 'stale_90d'
  | 'stale_180d'
  | 'unknown_spender'
  | 'non_verified_spender'
  | 'spender_is_eoa'
  | 'high_value_token_approval'
  | 'operator_approval'
  | 'current_approval_confirmed';

export type ApprovalRecord = {
  id: string;
  chain: SupportedChain;
  standard: ApprovalStandard;
  token: string;
  token_symbol?: string;
  token_name?: string;
  token_decimals?: number;
  owner: string;
  spender: string;
  allowance_raw?: string;
  allowance_display?: string;
  token_id?: string;
  approved: boolean;
  last_approval_tx?: string;
  last_approval_block?: string;
  last_approval_at?: string;
  spender_verified?: boolean;
  spender_label?: string;
  risk_flags: RiskFlag[];
  risk_score: number;
  revoke_tx_data: RevokeTxData;
};

export type RevokeTxData = {
  chain: SupportedChain;
  to: string;
  data: `0x${string}`;
  value: '0';
  method: 'approve(address,uint256)' | 'setApprovalForAll(address,bool)' | 'approve(address,uint256 tokenId)';
  description: string;
};

export type AuditOutput = {
  wallet: string;
  chains: SupportedChain[];
  generated_at: string;
  approvals: ApprovalRecord[];
  risk_flags: Record<string, RiskFlag[]>;
  revoke_tx_data: RevokeTxData[];
  warnings: string[];
  data_sources: string[];
};
