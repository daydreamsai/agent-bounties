import assert from 'node:assert/strict';
import test from 'node:test';
import { formatUnits, getAmountOut, parseUnits, spreadBps } from '../src/math.js';

test('constant product quote accounts for 30 bps fee', () => {
  const out = getAmountOut(1000n, 100000n, 200000n, 30);
  assert.equal(out, 1974n);
});

test('spread bps compares high output against low output', () => {
  assert.equal(spreadBps(101, 100), 100);
});

test('parseUnits and formatUnits round trip decimal strings', () => {
  const raw = parseUnits('1.234567', 6);
  assert.equal(raw, 1234567n);
  assert.equal(formatUnits(raw, 6), '1.234567');
});
