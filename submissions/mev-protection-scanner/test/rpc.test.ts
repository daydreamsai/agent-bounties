import assert from 'node:assert/strict';
import test from 'node:test';
import { hexWeiToGwei, normalizeTx } from '../src/rpc.js';

test('converts wei hex to gwei', () => {
  assert.equal(hexWeiToGwei('0x3b9aca00'), 1);
});

test('normalizes JSON-RPC transaction shape', () => {
  const tx = normalizeTx({
    hash: '0xabc',
    to: '0x0000000000000000000000000000000000000001',
    from: '0x0000000000000000000000000000000000000002',
    gasPrice: '0x3b9aca00',
    input: '0x38ed17390000',
    value: '0xde0b6b3a7640000'
  });
  assert.equal(tx.gas_price_gwei, 1);
  assert.equal(tx.input_prefix, '0x38ed1739');
  assert.equal(tx.value_eth, 1);
});
