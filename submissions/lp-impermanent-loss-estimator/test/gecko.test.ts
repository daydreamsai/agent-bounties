import assert from 'node:assert/strict';
import test from 'node:test';
import { priceRelativeFromOhlcv, volumeFromOhlcv, volumeFromSnapshot } from '../src/gecko.js';

test('OHLCV price relative uses first point inside requested window and latest close', () => {
  const now = 1_700_000_000;
  const result = priceRelativeFromOhlcv([
    { timestamp: now - 7200, open: 90, high: 100, low: 80, close: 100, volumeUsd: 10 },
    { timestamp: now - 3600, open: 100, high: 120, low: 95, close: 110, volumeUsd: 20 },
    { timestamp: now, open: 110, high: 140, low: 100, close: 121, volumeUsd: 30 }
  ], 1);
  assert.deepEqual(result, { start: 110, end: 121, relative: 1.1 });
});

test('OHLCV volume sums points in the requested window', () => {
  const now = 1_700_000_000;
  const volume = volumeFromOhlcv([
    { timestamp: now - 7200, open: 1, high: 1, low: 1, close: 1, volumeUsd: 10 },
    { timestamp: now - 1800, open: 1, high: 1, low: 1, close: 1, volumeUsd: 20 },
    { timestamp: now, open: 1, high: 1, low: 1, close: 1, volumeUsd: 30 }
  ], 1);
  assert.equal(volume, 50);
});

test('snapshot volume scales nearest GeckoTerminal window conservatively', () => {
  const volume = volumeFromSnapshot({
    reserveUsd: 1000,
    volumeWindows: { h1: 100, h6: 300, h24: 1200 },
    baseTokenPriceUsd: 1,
    quoteTokenPriceUsd: 1,
    feeBps: 30
  }, 3);
  assert.equal(volume, 150);
});
