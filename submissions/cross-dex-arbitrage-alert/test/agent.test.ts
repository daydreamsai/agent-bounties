import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArbCalculationEvidence } from '../src/agent.js';

test('calculation evidence rejects one-way spreads without positive round-trip profit', () => {
  const evidence = buildArbCalculationEvidence();
  const noFalsePositive = evidence.cases.find((testCase) => testCase.name.includes('round trip loses'));

  assert.equal(noFalsePositive?.expected_best_route, false);
  assert.equal(noFalsePositive?.actual_best_route, false);
  assert.equal(noFalsePositive?.actual_opportunity_count, 0);
  assert.equal(noFalsePositive?.pass, true);
});

test('calculation evidence accepts profitable round trips and applies thresholds', () => {
  const evidence = buildArbCalculationEvidence();
  const profitable = evidence.cases.find((testCase) => testCase.name.includes('profitable round trip'));
  const threshold = evidence.cases.find((testCase) => testCase.name.includes('threshold filters'));

  assert.equal(profitable?.actual_best_route, true);
  assert.equal(profitable?.actual_opportunity_count, 1);
  assert.ok((profitable?.roundtrip_profit_token_in ?? 0) > 0);
  assert.equal(threshold?.actual_best_route, false);
  assert.equal(threshold?.actual_opportunity_count, 0);
});

test('calculation evidence reports a full pass summary', () => {
  const evidence = buildArbCalculationEvidence();

  assert.equal(evidence.case_count, 3);
  assert.equal(evidence.pass_count, 3);
  assert.equal(evidence.pass_rate_pct, 100);
  assert.ok(evidence.cases.every((testCase) => testCase.pass));
});
