import assert from 'node:assert/strict';
import test from 'node:test';
import { annualizedIlDrag, feeAprFromWindow, normalizeWeights, weightedImpermanentLossPercent } from '../src/math.js';
import { inputSchema } from '../src/types.js';

test('normalizes token weights', () => {
  assert.deepEqual(normalizeWeights([80, 20]), [0.8, 0.2]);
  assert.throws(() => normalizeWeights([1, 0]), /positive/);
});

test('constant product 50/50 IL matches known 4x price move result', () => {
  const il = weightedImpermanentLossPercent([4, 1], [0.5, 0.5]);
  assert.ok(Math.abs(il - -20) < 1e-9);
});

test('weighted IL is zero when all token prices move equally', () => {
  const il = weightedImpermanentLossPercent([2, 2], [0.8, 0.2]);
  assert.ok(Math.abs(il) < 1e-9);
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
