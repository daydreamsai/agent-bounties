import assert from 'node:assert/strict';
import test from 'node:test';
import {
  annualizedIlDrag,
  buildIlBacktestSummary,
  feeAprFromWindow,
  normalizeWeights,
  weightedImpermanentLossPercent
} from '../src/math.js';
import { inputSchema } from '../src/types.js';

test('normalizes token weights', () => {
  assert.deepEqual(normalizeWeights([80, 20]), [0.8, 0.2]);
  assert.throws(() => normalizeWeights([1, 0]), /positive/);
});

test('constant product 50/50 IL matches known 4x price move result', () => {
  const il = weightedImpermanentLossPercent([4, 1], [0.5, 0.5]);
  assert.ok(Math.abs(il - -20) < 1e-9);
});

test('constant product 50/50 IL matches known inverse 0.25x price move result', () => {
  const il = weightedImpermanentLossPercent([0.25, 1], [0.5, 0.5]);
  assert.ok(Math.abs(il - -20) < 1e-9);
});

test('constant product 50/50 IL matches known 1.21x price move result', () => {
  const il = weightedImpermanentLossPercent([1.21, 1], [0.5, 0.5]);
  assert.ok(Math.abs(il - -0.452488687783) < 1e-9);
});

test('weighted 80/20 IL matches independent fixture', () => {
  const il = weightedImpermanentLossPercent([4, 1], [0.8, 0.2]);
  assert.ok(Math.abs(il - -10.840201969977) < 1e-9);
});

test('weighted IL is zero when all token prices move equally', () => {
  const il = weightedImpermanentLossPercent([2, 2], [0.8, 0.2]);
  assert.ok(Math.abs(il) < 1e-9);
});

test('backtest summary stays below 10 percent relative error threshold', () => {
  const summary = buildIlBacktestSummary();
  assert.equal(summary.case_count, 6);
  assert.equal(summary.pass_count, 6);
  assert.equal(summary.pass_rate_pct, 100);
  assert.ok(summary.max_absolute_error_pct_points < 1e-9);
  assert.ok(summary.max_relative_error_pct < 10);
  assert.ok(summary.cases.every((testCase) => testCase.pass));
});

test('fee APR annualizes observed window fees', () => {
  const apr = feeAprFromWindow({ volumeUsd: 1_000_000, tvlUsd: 10_000_000, feeBps: 30, windowHours: 24 });
  assert.equal(Math.round(apr * 100) / 100, 10.95);
});

test('annualized IL drag scales by window length', () => {
  assert.equal(annualizedIlDrag(-1, 24), -365);
});

test('input validation rejects invalid pool and unsupported network', () => {
  assert.throws(() => inputSchema.parse({ pool_address: '0x1234', deposit_amounts: [1, 1] }), /pool_address/);
  assert.throws(
    () => inputSchema.parse({ pool_address: '0x0000000000000000000000000000000000000001', network: 'solana', deposit_amounts: [1, 1] }),
    /Invalid option/
  );
});
