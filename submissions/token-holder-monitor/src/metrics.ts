import type { ConcentrationMetrics, HolderAlert, RiskLevel } from './types.js';

export function giniCoefficient(values: bigint[]): number {
  const positive = values.filter((value) => value > 0n).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const n = positive.length;
  if (n === 0) return 0;
  const total = positive.reduce((sum, value) => sum + value, 0n);
  if (total === 0n) return 0;
  let weighted = 0n;
  positive.forEach((value, index) => {
    weighted += BigInt(index + 1) * value;
  });
  const numerator = Number(2n * weighted);
  const denominator = Number(BigInt(n) * total);
  return round4(numerator / denominator - (n + 1) / n);
}

export function hhiIndex(values: bigint[], denominator?: bigint): number {
  const total = denominator && denominator > 0n ? denominator : values.reduce((sum, value) => sum + value, 0n);
  if (total === 0n) return 0;
  const hhi = values.reduce((sum, value) => {
    const share = Number(value) / Number(total);
    return sum + share * share;
  }, 0);
  return round4(hhi);
}

export function shareBps(value: bigint, denominator?: bigint): number | undefined {
  if (!denominator || denominator <= 0n) return undefined;
  return Number((value * 10_000n) / denominator);
}

export function concentrationMetrics(sortedBalances: bigint[], totalSupply?: bigint): ConcentrationMetrics {
  const sampleTotal = sortedBalances.reduce((sum, value) => sum + value, 0n);
  const denominator = totalSupply && totalSupply > 0n ? totalSupply : sampleTotal;
  const top = (n: number) => sortedBalances.slice(0, n).reduce((sum, value) => sum + value, 0n);
  return {
    gini_coefficient: giniCoefficient(sortedBalances),
    hhi_index: hhiIndex(sortedBalances, denominator),
    top_1_share_bps: shareBps(top(1), denominator) ?? 0,
    top_5_share_bps: shareBps(top(5), denominator) ?? 0,
    top_10_share_bps: shareBps(top(10), denominator) ?? 0,
    top_100_share_bps: shareBps(top(100), denominator) ?? 0,
    sample_balance_coverage_bps: totalSupply && totalSupply > 0n ? shareBps(sampleTotal, totalSupply) : undefined
  };
}

export function centralizationRisk(metrics: ConcentrationMetrics): RiskLevel {
  if (metrics.top_1_share_bps >= 5000 || metrics.top_10_share_bps >= 8500 || metrics.hhi_index >= 0.35) return 'critical';
  if (metrics.top_1_share_bps >= 3000 || metrics.top_10_share_bps >= 6500 || metrics.hhi_index >= 0.18) return 'high';
  if (metrics.top_1_share_bps >= 1500 || metrics.top_10_share_bps >= 4000 || metrics.hhi_index >= 0.08) return 'medium';
  return 'low';
}

export function alertsFor(metrics: ConcentrationMetrics, holderCount: number, sampled: boolean): HolderAlert[] {
  const alerts: HolderAlert[] = [];
  const risk = centralizationRisk(metrics);
  if (risk !== 'low') {
    alerts.push({
      severity: risk,
      type: 'concentration_risk',
      message: `Holder concentration is ${risk}; top 10 holders control ${(metrics.top_10_share_bps / 100).toFixed(2)}% of supply basis.`,
      evidence: metrics
    });
  }
  if (holderCount < 100) {
    alerts.push({
      severity: holderCount < 25 ? 'high' : 'medium',
      type: 'low_holder_count',
      message: `Only ${holderCount} holders were observed in the scan window.`,
      evidence: { holder_count: holderCount, sampled }
    });
  }
  if (sampled) {
    alerts.push({
      severity: 'medium',
      type: 'sampled_distribution',
      message: 'Distribution is derived from observed Transfer logs and current balance checks; it is not a full historical holder census.',
      evidence: { holder_count: holderCount, sample_balance_coverage_bps: metrics.sample_balance_coverage_bps }
    });
  }
  return alerts;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
