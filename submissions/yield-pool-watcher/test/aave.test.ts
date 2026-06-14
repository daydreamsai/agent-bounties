import assert from 'node:assert/strict';
import test from 'node:test';
import { aaveTestInternals } from '../src/aave.js';
import { defaultRules } from '../src/alerts.js';

const reserve = '0x1111111111111111111111111111111111111111';

function word(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

test('decodes Aave V3 ReserveDataUpdated block-level APY signal', () => {
  const signal = aaveTestInternals.decodeReserveDataUpdated({
    topics: [
      '0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a',
      `0x${'0'.repeat(24)}${reserve.slice(2)}`
    ],
    data: `0x${word(5n * 10n ** 25n)}${word(0n)}${word(7n * 10n ** 25n)}${word(0n)}${word(0n)}`,
    blockNumber: '0x10',
    transactionHash: '0xabc',
    logIndex: '0x2'
  }, '2026-06-15T00:00:00.000Z');

  assert.equal(signal.reserve, reserve);
  assert.equal(signal.block_number, 16);
  assert.equal(signal.liquidity_apy_pct, 5);
  assert.equal(signal.variable_borrow_apy_pct, 7);
  assert.equal(signal.source, 'aave-v3:ReserveDataUpdated');
});

test('block-level Aave alerts fire on APY absolute changes', () => {
  const first = aaveTestInternals.decodeReserveDataUpdated({
    topics: [
      '0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a',
      `0x${'0'.repeat(24)}${reserve.slice(2)}`
    ],
    data: `0x${word(1n * 10n ** 25n)}${word(0n)}${word(0n)}${word(0n)}${word(0n)}`,
    blockNumber: '0x10',
    transactionHash: '0xaaa',
    logIndex: '0x1'
  }, null);
  const second = { ...first, block_number: 17, transaction_hash: '0xbbb', log_index: 0, liquidity_apy_pct: 8 };
  const alerts = aaveTestInternals.buildBlockLevelAlerts([first, second], { ...defaultRules, apy_abs_change: 5 });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, 'apy_abs_change');
  assert.equal(alerts[0].source, 'aave-v3:ReserveDataUpdated');
  assert.equal(alerts[0].block_number, 17);
});
