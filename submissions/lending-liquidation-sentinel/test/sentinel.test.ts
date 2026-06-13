import assert from 'node:assert/strict';
import { test } from 'node:test';
import { testInternals } from '../src/aave.js';
import { sentinelInputSchema } from '../src/types.js';

test('input schema validates wallet and defaults protocol', () => {
  const parsed = sentinelInputSchema.parse({ wallet: '0x0000000000000000000000000000000000000001' });
  assert.deepEqual(parsed.protocol_ids, ['aave-v3-base']);
  assert.throws(() => sentinelInputSchema.parse({ wallet: 'bad' }));
});

test('encodes getUserAccountData call', () => {
  const data = testInternals.encodeGetUserAccountData('0x0000000000000000000000000000000000000001');
  assert.equal(data.length, 74);
  assert.ok(data.startsWith('0xbf92857c'));
});

test('decodes uint words', () => {
  const words = testInternals.decodeUintWords(`0x${'0'.repeat(63)}1${'0'.repeat(63)}2`);
  assert.equal(words[0], 1n);
  assert.equal(words[1], 2n);
});

test('health factor and buffer calculations handle infinity sentinel', () => {
  assert.equal(testInternals.healthFactorToNumber(15n * 10n ** 17n), 1.5);
  assert.equal(testInternals.bufferPercent(1.5), 50);
  assert.equal(testInternals.healthFactorToNumber(2n ** 256n - 1n), null);
});

test('liquidation price calculation uses supplied single-position data', () => {
  const liq = testInternals.calculateLiquidationPrice({ collateral_amount: 1, debt_amount: 1000, debt_price_usd: 1, liquidation_threshold: 0.8 });
  assert.equal(liq, 1250);
});
