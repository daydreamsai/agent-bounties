import { dexes } from './dexes.js';
import { formatUnits, getAmountOut, parseUnits, round, spreadBps } from './math.js';
import { factoryPair, nativeUsdPrice, pairReserves, pairTokens, routerGetAmountsOut, RpcClient, tokenDecimals, tokenUsdPrice } from './rpc.js';
import {
  inputSchema,
  type ArbCalculationEvidence,
  type ArbInput,
  type ArbOpportunity,
  type ArbOutput,
  type DexConfig,
  type QuoteRoute,
  type SupportedChain
} from './types.js';

export const agentMetadata = {
  name: 'cross-dex-arbitrage-alert',
  version: '0.1.0',
  description: 'Detects cross-DEX token price spreads after DEX fees and gas using live on-chain V2 reserve quotes.'
};

export async function runCrossDexArb(rawInput: unknown): Promise<ArbOutput> {
  const input = inputSchema.parse(rawInput);
  return detectArbitrage(input);
}

export async function detectArbitrage(input: ArbInput): Promise<ArbOutput> {
  const chains = input.chains || ['base'];
  const warnings: string[] = [];
  const dataSources = new Set<string>();
  const quotes: QuoteRoute[] = [];

  for (const chain of chains) {
    const chainDexes = dexes.filter((dex) => dex.chain === chain);
    const chainQuotes = await quoteChain(chain, chainDexes, input, warnings, dataSources);
    quotes.push(...chainQuotes);
  }

  const opportunities = buildOpportunities(quotes, input.threshold_bps ?? 0).slice(0, input.max_routes ?? 10);
  const best = opportunities[0] || null;

  if (quotes.length < 2) warnings.push('fewer than two live DEX quotes were available; arbitrage comparison is limited');
  if (!best) warnings.push('no route exceeded the requested threshold after fees and gas');

  return {
    token_in: input.token_in,
    token_out: input.token_out,
    amount_in: input.amount_in,
    chains,
    best_route: best,
    alt_routes: best ? opportunities.slice(1) : [],
    net_spread_bps: best ? round(best.net_spread_bps, 6) : null,
    est_fill_cost: best ? round(best.est_fill_cost, 8) : null,
    quotes,
    warnings,
    data_sources: [...dataSources].sort(),
    calculation_evidence: buildArbCalculationEvidence(),
    confidence: confidence(quotes, warnings)
  };
}

async function quoteChain(chain: SupportedChain, chainDexes: DexConfig[], input: ArbInput, warnings: string[], dataSources: Set<string>): Promise<QuoteRoute[]> {
  const rpc = new RpcClient(chain);
  const [decimalsIn, decimalsOut, gasPrice, block, tokenOutUsd, nativeUsd] = await Promise.all([
    tokenDecimals(rpc, input.token_in),
    tokenDecimals(rpc, input.token_out),
    rpc.gasPrice(),
    rpc.blockNumber(),
    tokenUsdPrice(chain, input.token_out).catch(() => null),
    nativeUsdPrice().catch(() => null)
  ]);
  dataSources.add(`rpc:${chain}`);
  if (tokenOutUsd !== null) dataSources.add(`defillama:price:${chain}`);
  if (nativeUsd !== null) dataSources.add('defillama:price:native');

  const amountInRaw = parseUnits(input.amount_in, decimalsIn);
  const routes: QuoteRoute[] = [];

  for (const dex of chainDexes) {
    try {
      const pair = await factoryPair(rpc, dex.factory, input.token_in, input.token_out);
      if (!pair) {
        warnings.push(`${dex.name} has no V2 pair for requested tokens on ${chain}`);
        continue;
      }
      const [{ token0, token1 }, { reserve0, reserve1 }] = await Promise.all([
        pairTokens(rpc, pair),
        pairReserves(rpc, pair)
      ]);
      const tokenInIs0 = token0.toLowerCase() === input.token_in.toLowerCase();
      const tokenOutIs1 = token1.toLowerCase() === input.token_out.toLowerCase();
      const tokenInIs1 = token1.toLowerCase() === input.token_in.toLowerCase();
      const tokenOutIs0 = token0.toLowerCase() === input.token_out.toLowerCase();
      if (!(tokenInIs0 && tokenOutIs1) && !(tokenInIs1 && tokenOutIs0)) {
        warnings.push(`${dex.name} pair token order did not match requested path`);
        continue;
      }
      const reserveIn = tokenInIs0 ? reserve0 : reserve1;
      const reserveOut = tokenInIs0 ? reserve1 : reserve0;
      const amountOutRaw = getAmountOut(amountInRaw, reserveIn, reserveOut, dex.feeBps);
      let routerAmountOutRaw: bigint | null = null;
      let routerQuoteErrorPct: number | null = null;
      if (dex.router) {
        try {
          routerAmountOutRaw = await routerGetAmountsOut(rpc, dex.router, amountInRaw, [input.token_in, input.token_out]);
          routerQuoteErrorPct = relativeErrorPct(amountOutRaw, routerAmountOutRaw);
          dataSources.add(`router:${chain}:${dex.name}`);
          if (routerQuoteErrorPct !== null && routerQuoteErrorPct > 1) {
            warnings.push(`${dex.name} reserve quote differs from router getAmountsOut by ${round(routerQuoteErrorPct, 6)}%`);
          }
        } catch (error) {
          warnings.push(`${dex.name} router getAmountsOut validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const amountOutDecimal = Number(formatUnits(amountOutRaw, decimalsOut));
      const gasCostUsd = nativeUsd === null ? null : Number(formatUnits(gasPrice * BigInt(dex.swapGasUnits), 18)) * nativeUsd;
      const gasCostTokenOut = gasCostUsd === null || !tokenOutUsd ? null : gasCostUsd / tokenOutUsd;
      const estFillCost = gasCostTokenOut ?? 0;
      routes.push({
        chain,
        dex: dex.name,
        factory: dex.factory,
        pair,
        token_in: input.token_in,
        token_out: input.token_out,
        amount_in: input.amount_in,
        amount_out: amountOutRaw.toString(),
        amount_out_decimal: round(amountOutDecimal, 8) ?? amountOutDecimal,
        fee_bps: dex.feeBps,
        gas_cost_usd: round(gasCostUsd, 8),
        gas_cost_token_out: round(gasCostTokenOut, 8),
        est_fill_cost: round(estFillCost, 8) ?? 0,
        net_output_after_cost: round(amountOutDecimal - estFillCost, 8) ?? amountOutDecimal,
        quote_block: block,
        quote_source: routerAmountOutRaw === null ? 'constant-product-v2-reserves' : 'constant-product-v2-reserves+router-getAmountsOut',
        router: dex.router,
        router_amount_out: routerAmountOutRaw?.toString(),
        router_quote_error_pct: round(routerQuoteErrorPct, 8),
        reserve_in: reserveIn.toString(),
        reserve_out: reserveOut.toString(),
        decimals_in: decimalsIn,
        decimals_out: decimalsOut
      });
    } catch (error) {
      warnings.push(`${dex.name} quote failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return routes;
}

function buildOpportunities(quotes: QuoteRoute[], thresholdBps: number): ArbOpportunity[] {
  const opportunities: ArbOpportunity[] = [];
  for (const buy of quotes) {
    for (const sell of quotes) {
      if (buy === sell) continue;
      const gross = spreadBps(buy.amount_out_decimal, sell.amount_out_decimal);
      const net = spreadBps(buy.net_output_after_cost, sell.amount_out_decimal);
      if (net < thresholdBps) continue;
      const roundtripProfit = roundTripProfitTokenIn(buy, sell);
      if (roundtripProfit === null || roundtripProfit <= 0) continue;
      opportunities.push({
        buy_route: buy,
        sell_route: sell,
        gross_spread_bps: round(gross, 6) ?? gross,
        net_spread_bps: round(net, 6) ?? net,
        est_fill_cost: round(buy.est_fill_cost + sell.est_fill_cost, 8) ?? 0,
        profit_token_out: round(buy.net_output_after_cost - sell.amount_out_decimal, 8) ?? 0,
        roundtrip_profit_token_in: round(roundtripProfit, 8),
        notes: [
          'net spread subtracts estimated swap gas in token_out terms when token_out USD price is available',
          'roundtrip_profit_token_in estimates token_in recovered by swapping buy_route output back through sell_route reserves'
        ]
      });
    }
  }
  return opportunities.sort((a, b) => {
    const aProfit = a.roundtrip_profit_token_in ?? Number.NEGATIVE_INFINITY;
    const bProfit = b.roundtrip_profit_token_in ?? Number.NEGATIVE_INFINITY;
    return bProfit === aProfit ? b.net_spread_bps - a.net_spread_bps : bProfit - aProfit;
  });
}

function relativeErrorPct(calculated: bigint, reference: bigint): number | null {
  if (reference === 0n) return calculated === 0n ? 0 : null;
  const scale = 1_000_000_000_000n;
  const diff = calculated > reference ? calculated - reference : reference - calculated;
  return Number((diff * scale) / reference) / Number(scale) * 100;
}

export function buildArbCalculationEvidence(): ArbCalculationEvidence {
  const cases = [
    {
      name: 'large one-way spread rejected when round trip loses token_in',
      threshold_bps: 0,
      quotes: [
        fixtureQuote('high-output-unprofitable', '110', 110, 109, '90000', '100000'),
        fixtureQuote('lower-output-reference', '100', 100, 100, '90000', '100000')
      ],
      expected_opportunity_count: 0,
      expected_best_route: false
    },
    {
      name: 'profitable round trip produces best route',
      threshold_bps: 0,
      quotes: [
        fixtureQuote('high-output-profitable', '120', 120, 119, '120000', '100000'),
        fixtureQuote('lower-output-reference', '100', 100, 100, '120000', '100000')
      ],
      expected_opportunity_count: 1,
      expected_best_route: true
    },
    {
      name: 'threshold filters otherwise profitable route',
      threshold_bps: 3000,
      quotes: [
        fixtureQuote('high-output-profitable', '120', 120, 119, '120000', '100000'),
        fixtureQuote('lower-output-reference', '100', 100, 100, '120000', '100000')
      ],
      expected_opportunity_count: 0,
      expected_best_route: false
    }
  ];

  const results = cases.map((testCase) => {
    const opportunities = buildOpportunities(testCase.quotes, testCase.threshold_bps);
    const actualBestRoute = opportunities.length > 0;
    const roundtripProfit = opportunities[0]?.roundtrip_profit_token_in ?? null;
    const pass =
      opportunities.length === testCase.expected_opportunity_count &&
      actualBestRoute === testCase.expected_best_route &&
      (roundtripProfit === null || roundtripProfit > 0);
    return {
      name: testCase.name,
      threshold_bps: testCase.threshold_bps,
      expected_opportunity_count: testCase.expected_opportunity_count,
      actual_opportunity_count: opportunities.length,
      expected_best_route: testCase.expected_best_route,
      actual_best_route: actualBestRoute,
      roundtrip_profit_token_in: round(roundtripProfit, 8),
      pass
    };
  });
  const passCount = results.filter((testCase) => testCase.pass).length;
  return {
    case_count: results.length,
    pass_count: passCount,
    pass_rate_pct: round((passCount / results.length) * 100, 6) ?? 0,
    cases: results
  };
}

function fixtureQuote(
  dex: string,
  amountOut: string,
  amountOutDecimal: number,
  netOutputAfterCost: number,
  reserveIn: string,
  reserveOut: string
): QuoteRoute {
  return {
    chain: 'base',
    dex,
    factory: '0x0000000000000000000000000000000000000000',
    pair: '0x0000000000000000000000000000000000000001',
    token_in: '0x0000000000000000000000000000000000000002',
    token_out: '0x0000000000000000000000000000000000000003',
    amount_in: '100',
    amount_out: amountOut,
    amount_out_decimal: amountOutDecimal,
    fee_bps: 30,
    gas_cost_usd: 0,
    gas_cost_token_out: 0,
    est_fill_cost: amountOutDecimal - netOutputAfterCost,
    net_output_after_cost: netOutputAfterCost,
    quote_block: 'fixture',
    quote_source: 'deterministic-fixture',
    reserve_in: reserveIn,
    reserve_out: reserveOut,
    decimals_in: 0,
    decimals_out: 0
  };
}

function roundTripProfitTokenIn(buy: QuoteRoute, sell: QuoteRoute): number | null {
  if (!sell.reserve_in || !sell.reserve_out || sell.decimals_in === undefined || sell.decimals_out === undefined) return null;
  try {
    const outAsTokenIn = getAmountOut(BigInt(buy.amount_out), BigInt(sell.reserve_out), BigInt(sell.reserve_in), sell.fee_bps);
    return Number(formatUnits(outAsTokenIn, sell.decimals_in)) - Number(buy.amount_in);
  } catch {
    return null;
  }
}

function confidence(quotes: QuoteRoute[], warnings: string[]): number {
  let score = 0.35;
  if (quotes.length >= 2) score += 0.35;
  if (quotes.some((quote) => quote.gas_cost_usd !== null)) score += 0.15;
  if (warnings.length === 0) score += 0.15;
  return Math.min(1, Math.round(score * 100) / 100);
}
