export function percentile(values, pct) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * pct) - 1));
  return sorted[idx];
}

export function normalizePair(raw) {
  const liquidityUsd = Number(raw?.liquidity?.usd || raw?.liquidity_usd || 0);
  const volume24h = Number(raw?.volume?.h24 || raw?.volume_24h || 0);
  const txns24h =
    Number(raw?.txns?.h24?.buys || 0) +
    Number(raw?.txns?.h24?.sells || 0) ||
    Number(raw?.txns_24h || 0);
  const volatilityPct = Math.abs(Number(raw?.priceChange?.h24 || raw?.volatility_pct || 0));

  return {
    chain: raw?.chainId || raw?.chain || "unknown",
    dex: raw?.dexId || raw?.dex || "unknown",
    pair_address: raw?.pairAddress || raw?.pair_address || null,
    liquidity_usd: liquidityUsd,
    volume_24h: volume24h,
    txns_24h: txns24h,
    volatility_pct: volatilityPct,
    base_token_address: raw?.baseToken?.address || raw?.base_token_address || null,
    quote_token_address: raw?.quoteToken?.address || raw?.quote_token_address || null,
    token_price_usd: Number(raw?.priceUsd || raw?.token_price_usd || 0),
    url: raw?.url || null
  };
}

export function estimateFromPools(input, rawPools) {
  const pools = rawPools.map(normalizePair).filter((pool) => pool.liquidity_usd > 0);
  if (!pools.length) {
    throw new Error("No liquid pools found for route");
  }

  pools.sort((a, b) => b.liquidity_usd - a.liquidity_usd);
  const routePools = pools.slice(0, 4);
  const totalLiquidityUsd = routePools.reduce((sum, pool) => sum + pool.liquidity_usd, 0);
  const totalVolume24h = routePools.reduce((sum, pool) => sum + pool.volume_24h, 0);
  const totalTxns24h = routePools.reduce((sum, pool) => sum + pool.txns_24h, 0);
  const weightedVolatilityPct = routePools.reduce((sum, pool) => {
    return sum + pool.volatility_pct * (pool.liquidity_usd / totalLiquidityUsd);
  }, 0);

  const amountUsd = resolveAmountUsd(input, routePools);
  const avgTradeUsd = totalTxns24h > 0 ? totalVolume24h / totalTxns24h : totalVolume24h / 100;
  const recentTradeSizeP95 = Math.max(avgTradeUsd * 3, avgTradeUsd);
  const marketImpactBps = totalLiquidityUsd > 0 ? (amountUsd / totalLiquidityUsd) * 10000 * 1.15 : 300;
  const volatilityBps = weightedVolatilityPct * 4;
  const sizePenaltyBps = recentTradeSizeP95 > 0 && amountUsd > recentTradeSizeP95
    ? Math.min(250, ((amountUsd / recentTradeSizeP95) - 1) * 25)
    : 0;
  const depthPenaltyBps = totalLiquidityUsd < 100_000 ? 80 : totalLiquidityUsd < 500_000 ? 35 : 10;

  const minSafeSlipBps = clamp(
    Math.ceil(20 + marketImpactBps + volatilityBps + sizePenaltyBps + depthPenaltyBps),
    25,
    1000
  );

  return {
    min_safe_slip_bps: minSafeSlipBps,
    pool_depths: routePools.map((pool) => ({
      chain: pool.chain,
      dex: pool.dex,
      pair_address: pool.pair_address,
      liquidity_usd: round(pool.liquidity_usd, 2),
      volume_24h: round(pool.volume_24h, 2),
      txns_24h: pool.txns_24h,
      volatility_pct: round(pool.volatility_pct, 3),
      url: pool.url
    })),
    recent_trade_size_p95: round(recentTradeSizeP95, 2),
    diagnostics: {
      amount_usd: round(amountUsd, 2),
      route_liquidity_usd: round(totalLiquidityUsd, 2),
      market_impact_bps: round(marketImpactBps, 2),
      volatility_bps: round(volatilityBps, 2),
      size_penalty_bps: round(sizePenaltyBps, 2),
      depth_penalty_bps: round(depthPenaltyBps, 2)
    },
    confidence: totalLiquidityUsd >= 500_000 && totalTxns24h >= 100 ? "high" : "medium"
  };
}

export function resolveAmountUsd(input, pools) {
  if (Number(input.amount_usd || input.amount_in_usd) > 0) {
    return Number(input.amount_usd || input.amount_in_usd);
  }

  const amountIn = Number(input.amount_in || 0);
  if (!Number.isFinite(amountIn) || amountIn <= 0) return 0;

  const tokenIn = String(input.token_in || "").toLowerCase();
  const pricedPool = pools.find((pool) => {
    return String(pool.base_token_address || "").toLowerCase() === tokenIn && pool.token_price_usd > 0;
  }) || pools.find((pool) => pool.token_price_usd > 0);

  return pricedPool ? amountIn * pricedPool.token_price_usd : amountIn;
}

export async function fetchDexscreenerPools(input, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const tokens = [input.token_in, input.token_out].filter(Boolean);
  const pools = [];

  for (const token of tokens) {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(token)}`;
    const response = await fetchImpl(url);
    if (!response.ok) continue;
    const payload = await response.json();
    pools.push(...(payload.pairs || []));
  }

  const tokenIn = String(input.token_in || "").toLowerCase();
  const tokenOut = String(input.token_out || "").toLowerCase();
  return pools.filter((pair) => {
    const base = String(pair?.baseToken?.address || "").toLowerCase();
    const quote = String(pair?.quoteToken?.address || "").toLowerCase();
    return [base, quote].includes(tokenIn) && [base, quote].includes(tokenOut);
  });
}

export async function estimateSlippage(input, options = {}) {
  const pools = options.pools || await fetchDexscreenerPools(input, options);
  const output = estimateFromPools(input, pools);
  return {
    ...output,
    route_hint: input.route_hint || null,
    checked_at: new Date().toISOString()
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}
