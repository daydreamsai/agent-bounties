import { z } from 'zod';

export const supportedChains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'] as const;
export type SupportedChain = (typeof supportedChains)[number];

export const scoreInputSchema = z.object({
  contract_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'contract_address must be an EVM address'),
  chain: z.enum(supportedChains),
  scan_depth: z.enum(['quick', 'deep']).default('quick').optional()
});

export type ScoreInput = z.infer<typeof scoreInputSchema>;

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type Vulnerability = {
  id: string;
  title: string;
  severity: Severity;
  evidence: string;
  source: 'goplus' | 'etherscan' | 'tokensniffer' | 'rpc' | 'bytecode' | 'source';
};

export type ExternalCheck = {
  provider: 'goplus' | 'etherscan' | 'tokensniffer' | 'rpc';
  status: 'ok' | 'unavailable' | 'error';
  evidence?: Record<string, unknown>;
  error?: string;
};

export type SecurityChecks = {
  is_contract: boolean;
  verified_source: boolean;
  proxy_detected: boolean;
  honeypot_detected?: boolean;
  owner_address?: string;
  ownership_renounced?: boolean;
  hidden_owner_detected?: boolean;
  high_tax_detected?: boolean;
  blacklist_detected?: boolean;
  mint_risk_detected?: boolean;
  source_patterns: string[];
  bytecode_patterns: string[];
};

export type ContractInfo = {
  chain: SupportedChain;
  chain_id: number;
  address: string;
  name?: string;
  symbol?: string;
  contract_name?: string;
  creator?: string;
  created_tx_hash?: string;
  compiler_version?: string;
  code_size_bytes: number;
  implementation_address?: string;
};

export type ScoreOutput = {
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  vulnerabilities: Vulnerability[];
  security_checks: SecurityChecks;
  external_checks: ExternalCheck[];
  contract_info: ContractInfo;
  recommendations: string[];
  confidence: number;
  generated_at: string;
  scan_depth: 'quick' | 'deep';
  data_sources: string[];
};
