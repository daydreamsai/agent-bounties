import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreInputSchema, supportedChains } from '../src/types.js';

test('input schema accepts supported chains and defaults quick scan depth', () => {
  const parsed = scoreInputSchema.parse({
    contract_address: '0x0000000000000000000000000000000000000001',
    chain: 'base'
  });

  assert.equal(parsed.scan_depth, 'quick');
  assert.ok(supportedChains.includes(parsed.chain));
});

test('input schema rejects invalid addresses and unsupported chains', () => {
  assert.throws(() => scoreInputSchema.parse({ contract_address: '0x1234', chain: 'base' }), /contract_address/);
  assert.throws(
    () => scoreInputSchema.parse({ contract_address: '0x0000000000000000000000000000000000000001', chain: 'solana' }),
    /Invalid option/
  );
});
