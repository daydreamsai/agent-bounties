import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bridgeInputSchema } from '../src/types.js';
import { testInternals } from '../src/lifi.js';
import { buildBridgeCalculationEvidence, selectBestRoute } from '../src/pinger.js';

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

test('best route ranking prefers highest USD output after total fees', () => {
  const expensive = {
    route_id: 'expensive',
    tool: 'fixture',
    bridge: 'fixture',
    from_chain: 'base',
    to_chain: 'optimism',
    from_token: 'ETH',
    to_token: 'ETH',
    from_amount: '1000',
    to_amount: '1000',
    to_amount_min: '990',
    from_amount_usd: 100,
    to_amount_usd: 101,
    eta_minutes: 2,
    fee_usd: 3,
    gas_fee_usd: 1,
    bridge_fee_usd: 2,
    requirements: [],
    included_steps: [],
    data_source: 'fixture'
  };
  const cheaper = { ...expensive, route_id: 'cheaper', to_amount_usd: 100, fee_usd: 0.5, gas_fee_usd: 0.2, bridge_fee_usd: 0.3 };

  assert.equal(selectBestRoute([expensive, cheaper])?.route_id, 'cheaper');
});

test('bridge calculation evidence summarizes route ranking fixtures', () => {
  const evidence = buildBridgeCalculationEvidence();

  assert.equal(evidence.case_count, 3);
  assert.equal(evidence.pass_count, 3);
  assert.equal(evidence.pass_rate_pct, 100);
  assert.ok(evidence.cases.every((testCase) => testCase.pass));
});
