import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMevCalculationEvidence, classifyRisk, isSwapLike, percentile } from '../src/scoring.js';
import type { PendingTxSample } from '../src/types.js';

function tx(gas: number, inputPrefix = '0x38ed1739'): PendingTxSample {
  return { hash: '0x', to: null, from: null, gas_price_gwei: gas, max_fee_per_gas_gwei: null, input_prefix: inputPrefix, value_eth: 0 };
}

test('detects swap-like calldata selectors', () => {
  assert.equal(isSwapLike(tx(10)), true);
  assert.equal(isSwapLike(tx(10, '0x12345678')), false);
});

test('computes gas percentile', () => {
  assert.equal(percentile(30, [10, 20, 30, 40]), 75);
});

test('classifies high gas competition as front-run risk', () => {
  const output = classifyRisk({
    amountUsd: 50000,
    pending: [tx(100), tx(120), tx(90), tx(10, '0x12345678')],
    userTx: tx(20),
    feeP50: 20,
    feeP90: 100,
    startMs: Date.now(),
    dataSources: ['test'],
    notes: []
  });
  assert.ok(output.risk_score >= 60);
  assert.equal(output.attack_type, 'front-run');
  assert.ok(output.estimated_loss_usd > 0);
});

test('classifies severe swap competition as sandwich risk', () => {
  const output = classifyRisk({
    amountUsd: 150000,
    pending: [tx(100), tx(120), tx(90), tx(80), tx(70)],
    userTx: tx(15),
    feeP50: 15,
    feeP90: 100,
    startMs: Date.now(),
    dataSources: ['test'],
    notes: []
  });
  assert.ok(output.risk_score >= 70);
  assert.equal(output.attack_type, 'sandwich');
});

test('calculation evidence covers no-risk through sandwich-risk scenarios', () => {
  const evidence = buildMevCalculationEvidence();

  assert.equal(evidence.case_count, 4);
  assert.equal(evidence.pass_count, 4);
  assert.equal(evidence.pass_rate_pct, 100);
  assert.deepEqual(
    evidence.cases.map((testCase) => testCase.actual_attack_type),
    ['none', 'back-run', 'front-run', 'sandwich']
  );
  assert.ok(evidence.cases.every((testCase) => testCase.pass));
});

test('calculation evidence keeps estimated losses aligned with attack type', () => {
  const evidence = buildMevCalculationEvidence();
  const noRisk = evidence.cases.find((testCase) => testCase.actual_attack_type === 'none');
  const sandwich = evidence.cases.find((testCase) => testCase.actual_attack_type === 'sandwich');

  assert.equal(noRisk?.estimated_loss_usd, 0);
  assert.ok((sandwich?.estimated_loss_usd ?? 0) > 0);
});
