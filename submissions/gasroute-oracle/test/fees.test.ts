import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGwei } from 'viem';
import {
  baseFeeTrendPct,
  buildGasRouteCalculationEvidence,
  calldataGasUnits,
  classifyBusyLevel,
  estimateFeeWei,
  gasEstimateErrorPct,
  percentile,
  suggestPriorityFee,
  totalGasUnits
} from '../src/fees.js';

test('calldata gas units use conservative EVM non-zero byte pricing', () => {
  assert.equal(calldataGasUnits(0), 0);
  assert.equal(calldataGasUnits(256), 4096);
  assert.equal(totalGasUnits(120000, 256), 124096);
});

test('fee estimate multiplies total gas units by gas price', () => {
  assert.equal(estimateFeeWei(25_000, parseGwei('2')).toString(), '50000000000000');
  assert.equal(estimateFeeWei(124_096, parseGwei('2')).toString(), '248192000000000');
});

test('priority fee picks percentile reward when feeHistory rewards exist', () => {
  const rewards = [[parseGwei('0.1'), parseGwei('0.3')], [parseGwei('0.2'), parseGwei('0.4')]];
  assert.equal(suggestPriorityFee(rewards, parseGwei('20')).toString(), parseGwei('0.3').toString());
});

test('busy level classification uses gas utilization and base fee trend', () => {
  assert.equal(classifyBusyLevel([0.2, 0.3, 0.4], null), 'low');
  assert.equal(classifyBusyLevel([0.55, 0.6, 0.5], null), 'medium');
  assert.equal(classifyBusyLevel([0.8, 0.78, 0.76], null), 'high');
  assert.equal(classifyBusyLevel([0.93, 0.95, 0.92], null), 'congested');
  assert.equal(classifyBusyLevel([0.3, 0.3], 30), 'congested');
});

test('base fee trend returns percentage change', () => {
  assert.equal(Math.round(baseFeeTrendPct([100n, 125n]) ?? 0), 25);
});

test('percentile handles empty and ordered bigint arrays', () => {
  assert.equal(percentile([], 60), 0n);
  assert.equal(percentile([3n, 1n, 2n], 60), 2n);
});

test('gas estimate error compares estimated gas with receipt gasUsed', () => {
  assert.equal(Math.round(gasEstimateErrorPct(124096, 124000) * 1_000_000) / 1_000_000, 0.077419);
  assert.throws(() => gasEstimateErrorPct(124096, 0), /observedGasUsed/);
});

test('calculation evidence summarizes gas route fee model checks', () => {
  const evidence = buildGasRouteCalculationEvidence();
  assert.equal(evidence.case_count, 4);
  assert.equal(evidence.pass_count, 4);
  assert.equal(evidence.pass_rate_pct, 100);
  assert.ok(evidence.max_gas_error_pct < 1);
  assert.equal(evidence.within_5pct_case_count, 1);
  assert.equal(evidence.within_5pct_pass_count, 1);
  assert.equal(evidence.within_5pct_threshold_pct, 5);
  assert.ok(evidence.cases.every((testCase) => testCase.pass));
});
