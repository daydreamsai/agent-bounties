import type { PoolDelta, PoolMetric, ThresholdRules, YieldAlert } from './types.js';

export const defaultRules: ThresholdRules = {
  tvl_drop_pct: 10,
  tvl_spike_pct: 25,
  apy_drop_pct: 20,
  apy_spike_pct: 50,
  apy_abs_change: 5,
  min_tvl_usd: 0
};

function severityFor(percent: number): YieldAlert['severity'] {
  if (percent >= 75) return 'critical';
  if (percent >= 30) return 'high';
  if (percent >= 10) return 'medium';
  return 'info';
}

export function percentDelta(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function absDelta(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  return current - previous;
}

export function evaluateAlerts(metrics: PoolMetric[], deltas: PoolDelta[], rules: ThresholdRules): YieldAlert[] {
  const byPool = new Map(metrics.map((metric) => [metric.pool, metric]));
  const alerts: YieldAlert[] = [];

  for (const delta of deltas) {
    const metric = byPool.get(delta.pool);
    if (!metric || metric.tvl_usd < rules.min_tvl_usd) continue;

    if (delta.tvl_delta_pct !== null && delta.tvl_delta_pct <= -rules.tvl_drop_pct) {
      alerts.push({ pool: metric.pool, project: metric.project, chain: metric.chain, severity: severityFor(Math.abs(delta.tvl_delta_pct)), type: 'tvl_drop', message: `TVL dropped ${Math.abs(delta.tvl_delta_pct).toFixed(2)}%`, observed_value: delta.tvl_delta_pct, threshold: -rules.tvl_drop_pct });
    }
    if (delta.tvl_delta_pct !== null && delta.tvl_delta_pct >= rules.tvl_spike_pct) {
      alerts.push({ pool: metric.pool, project: metric.project, chain: metric.chain, severity: severityFor(delta.tvl_delta_pct), type: 'tvl_spike', message: `TVL increased ${delta.tvl_delta_pct.toFixed(2)}%`, observed_value: delta.tvl_delta_pct, threshold: rules.tvl_spike_pct });
    }
    if (delta.apy_delta_pct !== null && delta.apy_delta_pct <= -rules.apy_drop_pct) {
      alerts.push({ pool: metric.pool, project: metric.project, chain: metric.chain, severity: severityFor(Math.abs(delta.apy_delta_pct)), type: 'apy_drop', message: `APY dropped ${Math.abs(delta.apy_delta_pct).toFixed(2)}%`, observed_value: delta.apy_delta_pct, threshold: -rules.apy_drop_pct });
    }
    if (delta.apy_delta_pct !== null && delta.apy_delta_pct >= rules.apy_spike_pct) {
      alerts.push({ pool: metric.pool, project: metric.project, chain: metric.chain, severity: severityFor(delta.apy_delta_pct), type: 'apy_spike', message: `APY increased ${delta.apy_delta_pct.toFixed(2)}%`, observed_value: delta.apy_delta_pct, threshold: rules.apy_spike_pct });
    }
    if (delta.apy_delta_abs !== null && Math.abs(delta.apy_delta_abs) >= rules.apy_abs_change) {
      alerts.push({ pool: metric.pool, project: metric.project, chain: metric.chain, severity: severityFor(Math.abs(delta.apy_delta_abs) * 4), type: 'apy_abs_change', message: `APY changed ${delta.apy_delta_abs.toFixed(2)} points`, observed_value: delta.apy_delta_abs, threshold: rules.apy_abs_change });
    }
  }

  return alerts;
}