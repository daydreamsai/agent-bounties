import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pulseInputSchema } from '../src/types.js';
import { testInternals } from '../src/sources.js';

test('input schema applies default venues and markets', () => {
  const parsed = pulseInputSchema.parse({});
  assert.deepEqual(parsed.venue_ids, ['hyperliquid']);
  assert.deepEqual(parsed.markets, ['BTC', 'ETH']);
  assert.equal(parsed.include_raw, false);
});

test('input schema rejects unsupported venues', () => {
  assert.throws(() => pulseInputSchema.parse({ venue_ids: ['unknown'], markets: ['BTC'] }));
});

test('market normalizer accepts common perps symbols', () => {
  assert.equal(testInternals.normalizeMarket('btcusdt'), 'BTC');
  assert.equal(testInternals.normalizeMarket('ETH-PERP'), 'ETH');
  assert.equal(testInternals.normalizeMarket(' sol/usdt '), 'SOL');
});

test('numeric parser returns null for missing or invalid values', () => {
  assert.equal(testInternals.numeric('0.0001'), 0.0001);
  assert.equal(testInternals.numeric(''), null);
  assert.equal(testInternals.numeric('not-a-number'), null);
});

test('secondsUntil floors elapsed timestamps at zero', () => {
  assert.equal(testInternals.secondsUntil(Date.now() - 10000), 0);
  const future = testInternals.secondsUntil(Date.now() + 60000);
  assert.ok(future !== null && future > 0 && future <= 60);
});
