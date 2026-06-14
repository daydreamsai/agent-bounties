import { dexes } from './dexes.js';
import { formatUnits, getAmountOut, parseUnits, round, spreadBps } from './math.js';
import { factoryPair, nativeUsdPrice, pairReserves, pairTokens, RpcClient, tokenDecimals, tokenUsdPrice } from './rpc.js';
import { inputSchema, type ArbInput, type ArbOpportunity, type ArbOutput, type DexConfig, type QuoteRoute, type SupportedChain } from './types.js';

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
        quote_source: 'constant-product-v2-reserves',
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
