import type { RiskFlag } from './types.js';
import { maxUint256 } from './calldata.js';

export const knownHighValueSymbols = new Set(['USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'ETH', 'LINK', 'UNI', 'AAVE', 'MKR', 'COMP', 'CRV', 'LDO']);

export function baseRiskFlags(args: {
  ageDays: number | null;
  staleDays: number;
  spenderInfo: { verified?: boolean; label?: string; isEoa?: boolean };
}): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (args.ageDays !== null) {
    if (args.ageDays >= 180) flags.push('stale_180d');
    else if (args.ageDays >= args.staleDays || args.ageDays >= 90) flags.push('stale_90d');
  }
  if (!args.spenderInfo.label) flags.push('unknown_spender');
  if (args.spenderInfo.verified === false) flags.push('non_verified_spender');
  if (args.spenderInfo.isEoa) flags.push('spender_is_eoa');
  return flags;
}

export function isLikelyHighValue(symbol: string | undefined, allowance: bigint, balance: bigint, decimals: number): boolean {
  if (!symbol || !knownHighValueSymbols.has(symbol.toUpperCase())) return false;
  if (allowance === maxUint256) return true;
  const scale = 10n ** BigInt(Math.min(Math.max(decimals, 0), 30));
  const threshold = ['USDC', 'USDT', 'DAI'].includes(symbol.toUpperCase()) ? 100n * scale : scale / 10n;
  return allowance >= threshold || balance >= threshold;
}
