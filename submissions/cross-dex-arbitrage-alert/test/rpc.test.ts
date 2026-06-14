import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeAddress, decodeUint, encodeAddress } from '../src/rpc.js';

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
