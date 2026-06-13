import assert from 'node:assert/strict';
import test from 'node:test';
import { monitorInputSchema, supportedChains } from '../src/types.js';

test('input schema accepts supported chains and defaults monitoring options', () => {
  const parsed = monitorInputSchema.parse({
    contract_address: '0x0000000000000000000000000000000000000001',
    chain: 'base'
  });

  assert.equal(parsed.min_holders, 100);
  assert.equal(parsed.top_n, 25);
  assert.ok(supportedChains.includes(parsed.chain));
});

test('input schema rejects invalid contract address and unsupported chain', () => {
  assert.throws(() => monitorInputSchema.parse({ contract_address: '0x1234', chain: 'base' }), /contract_address/);
  assert.throws(
    () => monitorInputSchema.parse({ contract_address: '0x0000000000000000000000000000000000000001', chain: 'solana' }),
    /Invalid option/
  );
});
