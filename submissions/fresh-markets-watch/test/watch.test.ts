import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getChainConfig } from '../src/chains.js';
import { decodeFactoryLog, PAIR_CREATED_TOPIC, POOL_CREATED_TOPIC, testInternals } from '../src/decoder.js';
import { TRANSFER_TOPIC, testInternals as enrichmentInternals } from '../src/enrichment.js';
import { watchInputSchema } from '../src/types.js';

test('input schema applies defaults and rejects invalid factories', () => {
  const parsed = watchInputSchema.parse({});
  assert.equal(parsed.chain, 'base');
  assert.equal(parsed.window_minutes, 10);
  assert.throws(() => watchInputSchema.parse({ factories: ['bad'] }));
});

test('chain config exposes base default factories', () => {
  const base = getChainConfig('base');
  assert.equal(base.id, 8453);
  assert.ok(base.factories.some((factory) => factory.type === 'v2'));
  assert.ok(base.factories.some((factory) => factory.type === 'v3'));
});

test('topic and data decoders extract addresses and numbers', () => {
  const address = '0x1111111111111111111111111111111111111111';
  const topic = `0x${'0'.repeat(24)}${address.slice(2)}`;
  assert.equal(testInternals.topicAddress(topic).toLowerCase(), address);
  const data = `0x${'0'.repeat(24)}${address.slice(2)}${'0'.repeat(63)}f`;
  assert.equal(testInternals.wordAddress(data, 0).toLowerCase(), address);
  assert.equal(testInternals.wordNumber(data, 1), 15);
});

test('decodes v2 PairCreated logs', () => {
  const pair = '0x3333333333333333333333333333333333333333';
  const token0 = '0x1111111111111111111111111111111111111111';
  const token1 = '0x2222222222222222222222222222222222222222';
  const log = {
    address: '0x71524B4f93c58fcbF659783284E38825f0622859',
    topics: [PAIR_CREATED_TOPIC, `0x${'0'.repeat(24)}${token0.slice(2)}`, `0x${'0'.repeat(24)}${token1.slice(2)}`],
    data: `0x${'0'.repeat(24)}${pair.slice(2)}${'0'.repeat(64)}`,
    blockNumber: '0x10',
    transactionHash: '0xabc',
    logIndex: '0x2'
  };
  const decoded = decodeFactoryLog(log, { address: log.address, protocol: 'SushiSwap V2', type: 'v2' }, 'base', '2026-01-01T00:00:00.000Z');
  assert.equal(decoded?.pair_address.toLowerCase(), pair);
  assert.deepEqual(decoded?.tokens.map((value) => value.toLowerCase()), [token0, token1]);
});

test('decodes v3 PoolCreated logs', () => {
  const pool = '0x4444444444444444444444444444444444444444';
  const token0 = '0x1111111111111111111111111111111111111111';
  const token1 = '0x2222222222222222222222222222222222222222';
  const fee = '00000000000000000000000000000000000000000000000000000000000001f4';
  const tickSpacing = '000000000000000000000000000000000000000000000000000000000000000a';
  const log = {
    address: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    topics: [POOL_CREATED_TOPIC, `0x${'0'.repeat(24)}${token0.slice(2)}`, `0x${'0'.repeat(24)}${token1.slice(2)}`],
    data: `0x${fee}${tickSpacing}${'0'.repeat(24)}${pool.slice(2)}`,
    blockNumber: '0x10',
    transactionHash: '0xdef',
    logIndex: '0x3'
  };
  const decoded = decodeFactoryLog(log, { address: log.address, protocol: 'Uniswap V3', type: 'v3' }, 'base', null);
  assert.equal(decoded?.pair_address.toLowerCase(), pool);
  assert.equal(decoded?.fee, 500);
});

test('extracts initial LP holders from pair mint transfer logs', () => {
  const pair = '0x3333333333333333333333333333333333333333';
  const holder = '0x9999999999999999999999999999999999999999';
  const logs = [{
    address: pair,
    topics: [TRANSFER_TOPIC, `0x${'0'.repeat(64)}`, `0x${'0'.repeat(24)}${holder.slice(2)}`],
    data: `0x${'0'.repeat(63)}a`,
    blockNumber: '0x10',
    transactionHash: '0xabc',
    logIndex: '0x4'
  }, {
    address: pair,
    topics: [TRANSFER_TOPIC, `0x${'0'.repeat(64)}`, `0x${'0'.repeat(64)}`],
    data: `0x${'0'.repeat(63)}1`,
    blockNumber: '0x10',
    transactionHash: '0xabc',
    logIndex: '0x5'
  }];
  const holders = enrichmentInternals.extractInitialLpHolders(logs, pair);
  assert.equal(holders.length, 1);
  assert.equal(holders[0].address, holder.toLowerCase());
  assert.equal(holders[0].amount_raw, '10');
});
