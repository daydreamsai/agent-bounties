import assert from 'node:assert/strict';
import test from 'node:test';
import { absDelta, defaultRules, evaluateAlerts, percentDelta } from '../src/alerts.js';
import type { PoolDelta, PoolMetric } from '../src/types.js';

const metric: PoolMetric = {
  pool: 'pool-1', project: 'aave-v3', chain: 'Ethereum', symbol: 'USDC', tvl_usd: 1_000_000,
  apy: 5, apy_base: 4, apy_reward: 1, il_risk: null, exposure: null, predictions: {}, underlying_tokens: [], reward_tokens: [], updated_at: new Date().toISOString()
};

test('percent and absolute deltas handle normal and missing values', () => {
  assert.equal(percentDelta(80, 100), -20);
  assert.equal(absDelta(80, 100), -20);
  assert.equal(percentDelta(100, 0), null);
  assert.equal(absDelta(null, 1), null);
});

test('alerts trigger on TVL drops and APY absolute changes', () => {
  const delta: PoolDelta = { pool: 'pool-1', tvl_delta_pct: -12, tvl_delta_usd: -120000, apy_delta_pct: 80, apy_delta_abs: 6, previous_tvl_usd: 1120000, previous_apy: 3, previous_observed_at: '2026-06-13T00:00:00.000Z', current_observed_at: '2026-06-14T00:00:00.000Z', sample_interval_seconds: 86400, source: 'defillama_chart' };
  const alerts = evaluateAlerts([metric], [delta], defaultRules);
  assert(alerts.some((alert) => alert.type === 'tvl_drop'));
  assert(alerts.some((alert) => alert.type === 'apy_spike'));
  assert(alerts.some((alert) => alert.type === 'apy_abs_change'));
});

test('alerts respect minimum TVL filter', () => {
  const delta: PoolDelta = { pool: 'pool-1', tvl_delta_pct: -80, tvl_delta_usd: -800000, apy_delta_pct: null, apy_delta_abs: null, previous_tvl_usd: 1800000, previous_apy: null, previous_observed_at: '2026-06-13T00:00:00.000Z', current_observed_at: '2026-06-14T00:00:00.000Z', sample_interval_seconds: 86400, source: 'defillama_chart' };
  const alerts = evaluateAlerts([metric], [delta], { ...defaultRules, min_tvl_usd: 2_000_000 });
  assert.equal(alerts.length, 0);
});
