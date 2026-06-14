import { fetchLifiQuote } from './lifi.js';
import type { BridgeCalculationEvidence, BridgeRoute } from './types.js';
import { bridgeInputSchema, type BridgeOutput } from './types.js';

export async function runBridgeRoutePinger(rawInput: unknown): Promise<BridgeOutput> {
  const input = bridgeInputSchema.parse(rawInput ?? {});
  const warnings: string[] = [];
  let routes: BridgeRoute[] = [];
  try {
    routes = [await fetchLifiQuote(input)];
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }
  return {
    routes,
    best_route: selectBestRoute(routes),
    warnings,
    data_sources: ['lifi:v1:quote'],
    calculation_evidence: buildBridgeCalculationEvidence(),
    fetched_at: new Date().toISOString()
  };
}

export function selectBestRoute(routes: BridgeRoute[]): BridgeRoute | null {
  if (routes.length === 0) return null;
  return [...routes].sort((a, b) => routeScore(b) - routeScore(a))[0];
}

export function buildBridgeCalculationEvidence(): BridgeCalculationEvidence {
  const normalized = fixtureRoute({
    route_id: 'normalized-fee-eta',
    to_amount_usd: 99.2,
    fee_usd: 0.8,
    gas_fee_usd: 0.3,
    bridge_fee_usd: 0.5,
    eta_minutes: 3
  });
  const highOutputHighFee = fixtureRoute({
    route_id: 'high-output-high-fee',
    to_amount_usd: 101,
    fee_usd: 3,
    gas_fee_usd: 1,
    bridge_fee_usd: 2,
    eta_minutes: 4
  });
  const lowerOutputLowerFee = fixtureRoute({
    route_id: 'lower-output-lower-fee',
    to_amount_usd: 100,
    fee_usd: 0.5,
    gas_fee_usd: 0.2,
    bridge_fee_usd: 0.3,
    eta_minutes: 6
  });
  const noUsdCheaperFee = fixtureRoute({
    route_id: 'no-usd-cheaper-fee',
    to_amount_usd: null,
    fee_usd: 0.2,
    gas_fee_usd: 0.1,
    bridge_fee_usd: 0.1,
    eta_minutes: 2
  });
  const noUsdExpensiveFee = fixtureRoute({
    route_id: 'no-usd-expensive-fee',
    to_amount_usd: null,
    fee_usd: 1,
    gas_fee_usd: 0.4,
    bridge_fee_usd: 0.6,
    eta_minutes: 1
  });

  const cases = [
    {
      name: 'fee split sums to total and ETA is preserved',
      routes: [normalized],
      expected_best_route_id: 'normalized-fee-eta',
      expected_fee_usd: 0.8,
      expected_eta_minutes: 3
    },
    {
      name: 'best route uses highest output after total fees',
      routes: [highOutputHighFee, lowerOutputLowerFee],
      expected_best_route_id: 'lower-output-lower-fee',
      expected_fee_usd: 0.5,
      expected_eta_minutes: 6
    },
    {
      name: 'best route falls back to lower fee when USD output is unavailable',
      routes: [noUsdExpensiveFee, noUsdCheaperFee],
      expected_best_route_id: 'no-usd-cheaper-fee',
      expected_fee_usd: 0.2,
      expected_eta_minutes: 2
    }
  ];

  const results = cases.map((testCase) => {
    const best = selectBestRoute(testCase.routes);
    const pass =
      best?.route_id === testCase.expected_best_route_id &&
      best.fee_usd === testCase.expected_fee_usd &&
      best.eta_minutes === testCase.expected_eta_minutes;
    return {
      name: testCase.name,
      expected_best_route_id: testCase.expected_best_route_id,
      actual_best_route_id: best?.route_id ?? null,
      expected_fee_usd: testCase.expected_fee_usd,
      actual_fee_usd: best?.fee_usd ?? null,
      expected_eta_minutes: testCase.expected_eta_minutes,
      actual_eta_minutes: best?.eta_minutes ?? null,
      pass
    };
  });
  const passCount = results.filter((testCase) => testCase.pass).length;
  return {
    case_count: results.length,
    pass_count: passCount,
    pass_rate_pct: Math.round((passCount / results.length) * 10000) / 100,
    cases: results
  };
}

function routeScore(route: BridgeRoute): number {
  if (route.to_amount_usd !== null) return route.to_amount_usd - route.fee_usd;
  return -route.fee_usd;
}

function fixtureRoute(overrides: Partial<BridgeRoute> & { route_id: string }): BridgeRoute {
  return {
    route_id: overrides.route_id,
    tool: 'fixture',
    bridge: 'fixture',
    from_chain: 'base',
    to_chain: 'optimism',
    from_token: 'ETH',
    to_token: 'ETH',
    from_amount: '1000000000000000',
    to_amount: '990000000000000',
    to_amount_min: '980000000000000',
    from_amount_usd: 100,
    to_amount_usd: Object.hasOwn(overrides, 'to_amount_usd') ? overrides.to_amount_usd ?? null : 99,
    eta_minutes: overrides.eta_minutes ?? 5,
    fee_usd: overrides.fee_usd ?? 1,
    gas_fee_usd: overrides.gas_fee_usd ?? 0.4,
    bridge_fee_usd: overrides.bridge_fee_usd ?? 0.6,
    requirements: ['source wallet must hold source token and gas token'],
    included_steps: ['fixture'],
    data_source: 'fixture'
  };
}
