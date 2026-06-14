import assert from 'node:assert/strict';
import test from 'node:test';
import { slippageInputSchema } from '../src/types.js';

test('input schema accepts token pair, amount, chain, and pool route hint', () => {
  const parsed = slippageInputSchema.parse({
    chain: 'base',
    token_in: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    token_out: '0x4200000000000000000000000000000000000006',
    amount_in: '1000',
    route_hint: { pool_address: '0xcdac0d6c6c59727a65f871236188350531885c43' }
  });
  assert.equal(parsed.chain, 'base');
  assert.equal(parsed.trade_window_hours, 6);
});

test('input schema rejects unsupported chain, invalid token, and non-positive amount', () => {
  assert.throws(() => slippageInputSchema.parse({ chain: 'solana', token_in: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', token_out: '0x4200000000000000000000000000000000000006', amount_in: '1' }));
  assert.throws(() => slippageInputSchema.parse({ chain: 'base', token_in: 'bad', token_out: '0x4200000000000000000000000000000000000006', amount_in: '1' }));
  assert.throws(() => slippageInputSchema.parse({ chain: 'base', token_in: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', token_out: '0x4200000000000000000000000000000000000006', amount_in: 0 }));
});
