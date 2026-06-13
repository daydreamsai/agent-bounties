import assert from 'node:assert/strict';
import test from 'node:test';
import { auditInputSchema } from '../src/types.js';
import { baseRiskFlags, isLikelyHighValue } from '../src/risk.js';

test('stale approval risk flags cover 90 and 180 day thresholds', () => {
  assert.deepEqual(baseRiskFlags({
    ageDays: 91,
    staleDays: 90,
    spenderInfo: { label: 'Known Router', verified: true, isEoa: false }
  }), ['stale_90d']);

  assert.deepEqual(baseRiskFlags({
    ageDays: 181,
    staleDays: 90,
    spenderInfo: { verified: false, isEoa: true }
  }), ['stale_180d', 'unknown_spender', 'non_verified_spender', 'spender_is_eoa']);
});

test('high-value token approval flags blue-chip balances and allowances', () => {
  assert.equal(isLikelyHighValue('USDC', 101_000000n, 0n, 6), true);
  assert.equal(isLikelyHighValue('WETH', 0n, 2_000000000000000000n, 18), true);
  assert.equal(isLikelyHighValue('MEME', 999_000000000000000000n, 0n, 18), false);
});

test('invalid wallet and unsupported chain are rejected before scanning', () => {
  assert.throws(() => auditInputSchema.parse({ wallet: '0x1234', chains: ['base'] }), /wallet must be an EVM address/);
  assert.throws(
    () => auditInputSchema.parse({ wallet: '0x0000000000000000000000000000000000000001', chains: ['solana'] }),
    /Invalid option/
  );
});
