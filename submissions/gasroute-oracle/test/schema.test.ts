import assert from 'node:assert/strict';
import test from 'node:test';
import { gasRouteInputSchema } from '../src/types.js';

test('input schema accepts supported chains and gas load', () => {
  const parsed = gasRouteInputSchema.parse({ chain_set: ['ethereum', 'base'], calldata_size_bytes: 128, gas_units_est: 120000 });
  assert.deepEqual(parsed.chain_set, ['ethereum', 'base']);
});

test('input schema rejects unsupported chain and too-low gas estimate', () => {
  assert.throws(() => gasRouteInputSchema.parse({ chain_set: ['solana'], calldata_size_bytes: 128, gas_units_est: 120000 }));
  assert.throws(() => gasRouteInputSchema.parse({ chain_set: ['base'], calldata_size_bytes: 128, gas_units_est: 1000 }));
});