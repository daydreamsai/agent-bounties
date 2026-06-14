import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeAddress, decodeUint, formatUnits } from '../src/onchain.js';

test('decodes ABI encoded address return values', () => {
  const encoded = '0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  assert.equal(decodeAddress(encoded), '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
});

test('decodes uint256 return values', () => {
  assert.equal(decodeUint('0x00000000000000000000000000000000000000000000000000000000000001f4'), 500n);
});

test('formats token balances with decimals', () => {
  assert.equal(formatUnits(123456789n, 6), '123.456789');
  assert.equal(formatUnits(1000000000000000000n, 18), '1');
});
