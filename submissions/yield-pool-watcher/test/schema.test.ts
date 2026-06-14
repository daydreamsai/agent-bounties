import assert from 'node:assert/strict';
import test from 'node:test';
import { watchInputSchema } from '../src/types.js';

test('input schema applies defaults and accepts filters', () => {
  const parsed = watchInputSchema.parse({ protocol_ids: ['aave-v3'], threshold_rules: { tvl_drop_pct: 5 } });
  assert.deepEqual(parsed.protocol_ids, ['aave-v3']);
  assert.deepEqual(parsed.pools, []);
  assert.equal(parsed.limit, 25);
  assert.equal(parsed.include_charts, true);
});

test('input schema rejects excessive limit and invalid thresholds', () => {
  assert.throws(() => watchInputSchema.parse({ limit: 1000 }));
  assert.throws(() => watchInputSchema.parse({ threshold_rules: { tvl_drop_pct: -1 } }));
});