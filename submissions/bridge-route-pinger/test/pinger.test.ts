import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bridgeInputSchema } from '../src/types.js';
import { testInternals } from '../src/lifi.js';

test('input schema applies defaults and validates from address', () => {
  const parsed = bridgeInputSchema.parse({});
  assert.equal(parsed.token, 'ETH');
  assert.equal(parsed.from_chain, 'base');
  assert.throws(() => bridgeInputSchema.parse({ from_address: 'not-wallet' }));
});

test('decimal amount conversion respects token decimals', () => {
  assert.equal(testInternals.decimalToAtomic('1.25', 6), '1250000');
  assert.equal(testInternals.decimalToAtomic('0.001', 18), '1000000000000000');
  assert.throws(() => testInternals.decimalToAtomic('1.0000001', 6));
});

test('chain and token resolver support common route inputs', () => {
  assert.equal(testInternals.resolveChain('base'), 8453);
  assert.equal(testInternals.resolveChain('10'), 10);
  assert.equal(testInternals.resolveToken('USDC', 8453).decimals, 6);
});

test('normalizeQuote sums LI.FI fee and gas costs', () => {
  const route = testInternals.normalizeQuote({
    id: 'route-1',
    tool: 'across',
    toolDetails: { name: 'AcrossV4' },
    action: { fromToken: { symbol: 'ETH', chainId: 8453 }, toToken: { symbol: 'ETH', chainId: 10 }, fromAmount: '1000' },
    estimate: {
      toAmount: '990',
      toAmountMin: '980',
      fromAmountUSD: '1.00',
      toAmountUSD: '0.98',
      executionDuration: 120,
      feeCosts: [{ name: 'Bridge fee', amountUSD: '0.10', included: true }],
      gasCosts: [{ type: 'SEND', amountUSD: '0.05', token: { symbol: 'ETH', chainId: 8453 } }]
    },
    includedSteps: [{ tool: 'across', toolDetails: { name: 'AcrossV4' } }]
  }, 'base', 'optimism');
  assert.equal(route.fee_usd, 0.15);
  assert.equal(route.eta_minutes, 2);
  assert.deepEqual(route.included_steps, ['AcrossV4']);
});
