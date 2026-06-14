import type { Severity, Vulnerability } from './types.js';

export type SourcePattern = {
  id: string;
  label: string;
  severity: Severity;
  regex: RegExp;
};

export const maliciousSourcePatterns: SourcePattern[] = [
  { id: 'blacklist', label: 'blacklist control', severity: 'high', regex: /\bblacklist(ed)?\b|\bisBlacklisted\b|\bblackList\b/i },
  { id: 'whitelist', label: 'whitelist transfer gate', severity: 'medium', regex: /\bwhitelist(ed)?\b|\bisWhitelisted\b/i },
  { id: 'trading-toggle', label: 'owner trading toggle', severity: 'medium', regex: /\btradingEnabled\b|\benableTrading\b|\bsetTrading\b/i },
  { id: 'max-tx', label: 'max transaction limit', severity: 'medium', regex: /\bmaxTx\b|\bmaxTransaction\b|\b_maxTxAmount\b/i },
  { id: 'max-wallet', label: 'max wallet limit', severity: 'medium', regex: /\bmaxWallet\b|\b_maxWallet\b/i },
  { id: 'cooldown', label: 'transfer cooldown', severity: 'medium', regex: /\bcooldown\b|\bcoolDown\b/i },
  { id: 'pause', label: 'pausable transfers', severity: 'medium', regex: /\bPausable\b|\b_pause\b|\bpaused\b/i },
  { id: 'mint', label: 'mint function', severity: 'high', regex: /\bfunction\s+mint\b|\b_mint\s*\(/i },
  { id: 'burn-from', label: 'burnFrom control', severity: 'medium', regex: /\bburnFrom\s*\(/i },
  { id: 'set-fee', label: 'mutable fee setter', severity: 'high', regex: /\bset.*Fee\b|\bupdate.*Fee\b|\btaxFee\b/i },
  { id: 'buy-tax', label: 'buy tax logic', severity: 'medium', regex: /\bbuyTax\b|\b_buyTax\b|\bbuyFee\b/i },
  { id: 'sell-tax', label: 'sell tax logic', severity: 'medium', regex: /\bsellTax\b|\b_sellTax\b|\bsellFee\b/i },
  { id: 'transfer-tax', label: 'transfer tax logic', severity: 'medium', regex: /\btransferTax\b|\btaxTransfer\b/i },
  { id: 'exclude-fee', label: 'fee exclusion list', severity: 'medium', regex: /\bexcludeFromFee\b|\bisExcludedFromFee\b/i },
  { id: 'anti-bot', label: 'anti-bot gate', severity: 'medium', regex: /\bantiBot\b|\bbotProtection\b|\bisBot\b/i },
  { id: 'set-router', label: 'mutable router', severity: 'medium', regex: /\bsetRouter\b|\bupdateRouter\b|\bswapRouter\b/i },
  { id: 'set-pair', label: 'mutable pair', severity: 'medium', regex: /\bsetPair\b|\bautomatedMarketMakerPairs\b/i },
  { id: 'manual-swap', label: 'manual swap function', severity: 'medium', regex: /\bmanualSwap\b|\bswapBack\b|\bswapTokensForEth\b/i },
  { id: 'rescue-token', label: 'rescue token function', severity: 'medium', regex: /\brescueToken\b|\brecoverERC20\b|\bwithdrawToken\b/i },
  { id: 'withdraw-eth', label: 'owner ETH withdrawal', severity: 'medium', regex: /\bwithdrawETH\b|\bwithdrawEth\b|\bwithdrawBNB\b/i },
  { id: 'delegatecall', label: 'delegatecall usage', severity: 'high', regex: /\bdelegatecall\b/i },
  { id: 'selfdestruct', label: 'selfdestruct usage', severity: 'critical', regex: /\bselfdestruct\b|\bsuicide\b/i },
  { id: 'tx-origin', label: 'tx.origin authorization', severity: 'high', regex: /\btx\.origin\b/i },
  { id: 'assembly', label: 'inline assembly', severity: 'medium', regex: /\bassembly\s*\{/i },
  { id: 'only-owner', label: 'owner-gated controls', severity: 'low', regex: /\bonlyOwner\b|\bOwnable\b/i },
  { id: 'role-admin', label: 'role admin controls', severity: 'low', regex: /\bDEFAULT_ADMIN_ROLE\b|\bAccessControl\b/i },
  { id: 'upgradeable', label: 'upgradeable proxy logic', severity: 'medium', regex: /\bUUPSUpgradeable\b|\bTransparentUpgradeableProxy\b|\b_upgradeTo\b/i },
  { id: 'set-implementation', label: 'mutable implementation', severity: 'high', regex: /\b_setImplementation\b|\bupgradeTo\b/i },
  { id: 'transfer-delay', label: 'transfer delay', severity: 'medium', regex: /\btransferDelay\b|\b_delayTransfer\b/i },
  { id: 'launch-block', label: 'launch-block rules', severity: 'medium', regex: /\blaunchedAt\b|\blaunchedBlock\b|\blaunchBlock\b/i },
  { id: 'holder-limit', label: 'holder limit', severity: 'medium', regex: /\bholderLimit\b|\bmaxHolder\b/i },
  { id: 'reflection', label: 'reflection accounting', severity: 'low', regex: /\breflection\b|\b_rOwned\b|\b_tOwned\b/i },
  { id: 'rebase', label: 'rebase logic', severity: 'medium', regex: /\brebase\b|\bgonsPerFragment\b/i },
  { id: 'oracle-write', label: 'mutable oracle', severity: 'high', regex: /\bsetOracle\b|\bupdateOracle\b/i },
  { id: 'price-manip', label: 'manual price setter', severity: 'high', regex: /\bsetPrice\b|\bmanualPrice\b/i },
  { id: 'transfer-hook', label: 'custom transfer hook', severity: 'medium', regex: /\b_beforeTokenTransfer\b|\b_afterTokenTransfer\b/i },
  { id: 'permit', label: 'permit signature surface', severity: 'low', regex: /\bpermit\s*\(/i },
  { id: 'unlimited-approval', label: 'unlimited approval helper', severity: 'low', regex: /\btype\s*\(\s*uint256\s*\)\.max\b|\bMAX_UINT\b/i },
  { id: 'fee-denominator', label: 'fee denominator mutation', severity: 'medium', regex: /\bfeeDenominator\b|\btaxDenominator\b/i },
  { id: 'owner-can-transfer', label: 'owner transfer override', severity: 'high', regex: /\bforceTransfer\b|\badminTransfer\b/i },
  { id: 'airdrop', label: 'airdrop batch transfer', severity: 'low', regex: /\bairdrop\b|\bbatchTransfer\b/i },
  { id: 'liquidity-lock', label: 'liquidity lock references', severity: 'low', regex: /\blockLiquidity\b|\bliquidityLock\b/i },
  { id: 'unlock', label: 'unlock controls', severity: 'medium', regex: /\bunlock\b|\breleaseLock\b/i },
  { id: 'snapshot', label: 'snapshot logic', severity: 'low', regex: /\bERC20Snapshot\b|\bsnapshot\b/i },
  { id: 'claim', label: 'claim function', severity: 'low', regex: /\bfunction\s+claim\b|\bclaimRewards\b/i },
  { id: 'owner-set-wallet', label: 'mutable fee wallets', severity: 'medium', regex: /\bset.*Wallet\b|\bmarketingWallet\b|\bdevWallet\b/i },
  { id: 'swap-enabled', label: 'owner swap toggle', severity: 'medium', regex: /\bswapEnabled\b|\bsetSwapEnabled\b/i },
  { id: 'fee-cap-missing', label: 'fee logic without obvious cap', severity: 'medium', regex: /\b_fee\b|\bTax\b/i },
  { id: 'external-call', label: 'external call surface', severity: 'medium', regex: /\.call\s*\{|\bcall\s*\(/i },
  { id: 'low-level-send', label: 'low-level send surface', severity: 'medium', regex: /\.send\s*\(|\.transfer\s*\(/i },
  { id: 'randomness', label: 'weak randomness', severity: 'medium', regex: /\bblock\.timestamp\b|\bblockhash\b|\bblock\.prevrandao\b/i },
  { id: 'signature-recover', label: 'signature recovery', severity: 'low', regex: /\becrecover\b|\brecover\s*\(/i },
  { id: 'unchecked', label: 'unchecked arithmetic block', severity: 'low', regex: /\bunchecked\s*\{/i },
  { id: 'tax-exempt-owner', label: 'owner tax exemption', severity: 'medium', regex: /\b_isExcluded\b|\bexclude.*owner\b/i }
];

export function analyzeSourcePatterns(source: string): Vulnerability[] {
  const normalized = source.slice(0, 2_000_000);
  const seen = new Set<string>();
  const findings: Vulnerability[] = [];
  for (const pattern of maliciousSourcePatterns) {
    if (!seen.has(pattern.id) && pattern.regex.test(normalized)) {
      seen.add(pattern.id);
      findings.push({
        id: `source_${pattern.id}`,
        title: pattern.label,
        severity: pattern.severity,
        evidence: `Source code matches ${pattern.id}`,
        source: 'source'
      });
    }
  }
  return findings;
}
