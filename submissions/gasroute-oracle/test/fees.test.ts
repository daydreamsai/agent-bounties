import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGwei } from 'viem';
import { baseFeeTrendPct, calldataGasUnits, classifyBusyLevel, estimateFeeWei, percentile, suggestPriorityFee } from '../src/fees.js';

test('calldata gas units use conservative EVM non-zero byte pricing', () => {
  assert.equal(calldataGasUnits(0), 0);
  assert.equal(calldataGasUnits(256), 4096);
});

test('fee estimate multiplies total gas units by gas price', () => {
  assert.equal(estimateFeeWei(25_000, parseGwei('2')).toString(), '50000000000000');
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