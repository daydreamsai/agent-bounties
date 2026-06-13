import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveSafeSlippageBps, estimatePriceImpactBps, percentile } from '../src/slippage.js';

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
