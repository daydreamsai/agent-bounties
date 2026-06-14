import assert from 'node:assert/strict';
import test from 'node:test';
import { hexWeiToGwei, infuraWssUrlForChain, normalizeTx, parsePendingHashMessage } from '../src/rpc.js';

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

test('parses Infura newPendingTransactions subscription messages', () => {
  const hash = '0x' + 'a'.repeat(64);

  assert.equal(parsePendingHashMessage(JSON.stringify({ params: { result: hash } })), hash);
  assert.equal(parsePendingHashMessage(JSON.stringify({ result: hash })), hash);
  assert.equal(parsePendingHashMessage(JSON.stringify({ params: { result: '0x1234' } })), null);
  assert.equal(parsePendingHashMessage('not-json'), null);
});

test('selects chain-specific Infura WebSocket URLs before generic fallback', () => {
  const oldGeneric = process.env.INFURA_WSS_URL;
  const oldEth = process.env.INFURA_ETHEREUM_WSS_URL;
  const oldBase = process.env.INFURA_BASE_WSS_URL;
  try {
    process.env.INFURA_WSS_URL = 'wss://generic.example';
    process.env.INFURA_ETHEREUM_WSS_URL = 'wss://eth.example';
    process.env.INFURA_BASE_WSS_URL = 'wss://base.example';

    assert.equal(infuraWssUrlForChain('eth'), 'wss://eth.example');
    assert.equal(infuraWssUrlForChain('base'), 'wss://base.example');

    delete process.env.INFURA_BASE_WSS_URL;
    assert.equal(infuraWssUrlForChain('base'), 'wss://generic.example');
  } finally {
    restoreEnv('INFURA_WSS_URL', oldGeneric);
    restoreEnv('INFURA_ETHEREUM_WSS_URL', oldEth);
    restoreEnv('INFURA_BASE_WSS_URL', oldBase);
  }
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
