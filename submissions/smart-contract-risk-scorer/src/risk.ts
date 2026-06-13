import type { Severity, Vulnerability } from './types.js';

const severityWeights: Record<Severity, number> = {
  low: 4,
  medium: 10,
  high: 20,
  critical: 35
};

export function scoreFindings(findings: Vulnerability[], confidence: number): { risk_score: number; risk_level: 'low' | 'medium' | 'high' | 'critical' } {
  const raw = findings.reduce((sum, finding) => sum + severityWeights[finding.severity], 0);
  const confidencePenalty = confidence < 0.45 ? 8 : confidence < 0.7 ? 4 : 0;
  const criticalFloor = findings.some((finding) => finding.severity === 'critical') ? 80 : 0;
  const risk_score = Math.min(100, Math.max(criticalFloor, Math.round(raw + confidencePenalty)));
  return {
    risk_score,
    risk_level: riskLevel(risk_score)
  };
}

export function riskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export function dedupeFindings(findings: Vulnerability[]): Vulnerability[] {
  const out = new Map<string, Vulnerability>();
  for (const finding of findings) out.set(finding.id, finding);
  return [...out.values()].sort((a, b) => severityWeights[b.severity] - severityWeights[a.severity] || a.id.localeCompare(b.id));
}

export function recommendationsFor(findings: Vulnerability[]): string[] {
  const ids = new Set(findings.map((item) => item.id));
  const recommendations = new Set<string>();
  if (ids.has('goplus_honeypot')) recommendations.add('Do not buy or interact until honeypot status is independently cleared.');
  if ([...ids].some((id) => id.includes('owner') || id.includes('ownership'))) recommendations.add('Review owner privileges, multisig/timelock controls, and renouncement status before interacting.');
  if ([...ids].some((id) => id.includes('tax') || id.includes('fee'))) recommendations.add('Check current buy/sell taxes on a small simulation before trading.');
  if ([...ids].some((id) => id.includes('proxy') || id.includes('upgrade'))) recommendations.add('Treat upgradeable contracts as mutable; verify implementation admin and upgrade history.');
  if ([...ids].some((id) => id.includes('blacklist') || id.includes('whitelist'))) recommendations.add('Avoid contracts with blacklist or whitelist gates unless the policy is documented and governed.');
  if ([...ids].some((id) => id.includes('source_unverified'))) recommendations.add('Require verified source code or a trusted audit before high-value interaction.');
  if (recommendations.size === 0) recommendations.add('No critical automated flags were detected; still perform manual review before committing funds.');
  return [...recommendations];
}
