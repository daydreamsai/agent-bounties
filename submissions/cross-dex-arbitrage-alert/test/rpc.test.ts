import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeAddress, decodeGetAmountsOut, decodeUint, encodeAddress, getAmountsOutCalldata } from '../src/rpc.js';

test('ABI encodes address arguments', () => {
  assert.equal(
    encodeAddress('0x4200000000000000000000000000000000000006'),
    '0000000000000000000000004200000000000000000000000000000000000006'
  );
});

test('ABI decodes address return values', () => {
  assert.equal(
    decodeAddress('0x000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913'),
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
  );
});

test('ABI decodes uint return values', () => {
  assert.equal(decodeUint('0x0000000000000000000000000000000000000000000000000000000000000064'), 100n);
});

test('ABI encodes router getAmountsOut for a two token path', () => {
  const calldata = getAmountsOutCalldata(1_000_000_000_000_000_000n, [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
  ]);

  assert.equal(calldata.slice(0, 10), '0xd06ca61f');
  assert.equal(calldata.length, 10 + 64 * 5);
  assert.ok(calldata.toLowerCase().includes('000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'));
  assert.ok(calldata.toLowerCase().includes('000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'));
});

test('ABI decodes router getAmountsOut second amount', () => {
  const encoded = [
    '0x',
    '0000000000000000000000000000000000000000000000000000000000000020',
    '0000000000000000000000000000000000000000000000000000000000000002',
    '0000000000000000000000000000000000000000000000000de0b6b3a7640000',
    '0000000000000000000000000000000000000000000000000000000005f5e100'
  ].join('');

  assert.equal(decodeGetAmountsOut(encoded), 100_000_000n);
});
