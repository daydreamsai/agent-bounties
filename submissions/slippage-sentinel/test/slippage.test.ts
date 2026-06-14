import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveSafeSlippageBps, estimatePriceImpactBps, percentile, runDeterministicBacktest } from '../src/slippage.js';

test('percentile returns p95 from ordered trade sizes', () => {
  assert.equal(percentile([1, 5, 2, 20, 10], 95), 20);
  assert.equal(percentile([], 95), null);
});

test('price impact increases as swap size approaches pool depth', () => {
  const small = estimatePriceImpactBps(1_000, 10_000_000);
  const large = estimatePriceImpactBps(100_000, 10_000_000);
  assert.ok(small > 0);
  assert.ok(large > small);
});

test('safe slippage includes fee, volatility, and flow buffers', () => {
  const quiet = deriveSafeSlippageBps({ impactBps: 10, feeBps: 5, volatility1hPct: 0.05, recentTradeP95Usd: 1000, amountUsd: 10000 });
  const volatile = deriveSafeSlippageBps({ impactBps: 10, feeBps: 5, volatility1hPct: 5, recentTradeP95Usd: 100000, amountUsd: 10000 });
  assert.ok(quiet >= 5);
  assert.ok(volatile > quiet);
});

test('safe slippage recommendation is capped to avoid reckless tolerance', () => {
  const bps = deriveSafeSlippageBps({ impactBps: 9999, feeBps: 100, volatility1hPct: 50, recentTradeP95Usd: 1_000_000, amountUsd: 1 });
  assert.equal(bps, 3000);
});

test('deterministic backtest fixtures are fully covered', () => {
  const summary = runDeterministicBacktest();
  assert.equal(summary.scenario_count, 6);
  assert.equal(summary.covered_count, 6);
  assert.equal(summary.pass_rate_pct, 100);
  assert.equal(summary.max_shortfall_bps, 0);
  assert.equal(summary.simulated_swap_count, 100);
  assert.ok(summary.simulated_prevented_revert_rate_pct >= 95);
  assert.equal(summary.simulated_required_threshold_pct, 95);
  assert.ok(summary.cases.every((item) => item.recommended_bps >= item.required_bps));
});
