import type { FundingMetric, VenueId } from './types.js';

const HYPERLIQUID_INFO = 'https://api.hyperliquid.xyz/info';
const BINANCE_FAPI = 'https://fapi.binance.com';
const BYBIT_API = 'https://api.bybit.com';

interface HyperliquidAsset {
  name: string;
}

interface HyperliquidCtx {
  funding?: string;
  openInterest?: string;
  markPx?: string;
  oraclePx?: string;
}

interface BinancePremiumIndex {
  symbol: string;
  markPrice?: string;
  indexPrice?: string;
  lastFundingRate?: string;
  nextFundingTime?: number;
  time?: number;
}

interface BinanceOpenInterest {
  openInterest?: string;
  time?: number;
}

interface BinanceLongShortRatio {
  longShortRatio?: string;
  timestamp?: number;
}

interface BybitTicker {
  symbol: string;
  fundingRate?: string;
  nextFundingTime?: string;
  openInterest?: string;
  openInterestValue?: string;
  markPrice?: string;
  indexPrice?: string;
  fundingIntervalHour?: string;
}

function numeric(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function iso(ms: number | null | undefined): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function secondsUntil(ms: number | null | undefined): number | null {
  if (!ms || !Number.isFinite(ms)) return null;
  return Math.max(0, Math.round((ms - Date.now()) / 1000));
}

function normalizeMarket(market: string): string {
  return market.trim().toUpperCase().replace(/[-_/ ]?PERP$/, '').replace(/[-_/ ]?USDT$/, '');
}

function binanceSymbol(market: string): string {
  return `${normalizeMarket(market)}USDT`;
}

async function fetchJsonOnce<T>(url: string, init?: RequestInit, timeoutMs = 10000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const response = await Promise.race([
      fetch(url, { ...init, headers: { accept: 'application/json', 'user-agent': 'perps-funding-pulse/0.1', ...(init?.headers ?? {}) } }),
      new Promise<Response>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${url} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return await response.json() as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 10000, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJsonOnce<T>(url, init, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${url} failed after ${attempts} attempts: ${message}`);
}

export async function fetchHyperliquid(markets: string[], includeRaw = false): Promise<{ metrics: FundingMetric[]; warnings: string[] }> {
  const payload = await fetchJson<[ { universe?: HyperliquidAsset[] }, HyperliquidCtx[] ]>(HYPERLIQUID_INFO, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' })
  });
  const assets = payload[0].universe ?? [];
  const ctxs = payload[1] ?? [];
  const wanted = new Set(markets.map(normalizeMarket));
  const warnings: string[] = [];
  const metrics: FundingMetric[] = [];
  assets.forEach((asset, index) => {
    const market = normalizeMarket(asset.name);
    if (!wanted.has(market)) return;
    const ctx = ctxs[index] ?? {};
    const funding = numeric(ctx.funding);
    const oi = numeric(ctx.openInterest);
    const mark = numeric(ctx.markPx);
    const oracle = numeric(ctx.oraclePx);
    metrics.push({
      venue: 'hyperliquid',
      market,
      symbol: asset.name,
      funding_rate: funding,
      funding_rate_bps: funding === null ? null : funding * 10000,
      funding_interval_hours: 1,
      next_funding_time: null,
      time_to_next_seconds: null,
      open_interest: oi,
      open_interest_usd: oi !== null && mark !== null ? oi * mark : null,
      mark_price: mark,
      index_price: oracle,
      skew: null,
      skew_source: null,
      source_timestamp: null,
      data_source: 'hyperliquid:info:metaAndAssetCtxs',
      raw: includeRaw ? ctx : undefined
    });
  });
  for (const market of wanted) {
    if (!metrics.some((metric) => metric.market === market)) warnings.push(`hyperliquid:${market} not found`);
  }
  if (metrics.length > 0) warnings.push('hyperliquid does not expose public long/short skew in metaAndAssetCtxs; skew is null.');
  return { metrics, warnings };
}

export async function fetchBinance(markets: string[], includeRaw = false): Promise<{ metrics: FundingMetric[]; warnings: string[] }> {
  const warnings: string[] = [];
  const metrics: FundingMetric[] = [];
  for (const marketInput of markets) {
    const market = normalizeMarket(marketInput);
    const symbol = binanceSymbol(market);
    try {
      const [premium, oi, skewRows] = await Promise.all([
        fetchJson<BinancePremiumIndex>(`${BINANCE_FAPI}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`, undefined, 5000, 2),
        fetchJson<BinanceOpenInterest>(`${BINANCE_FAPI}/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`, undefined, 5000, 2),
        fetchJson<BinanceLongShortRatio[]>(`${BINANCE_FAPI}/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(symbol)}&period=5m&limit=1`, undefined, 5000, 2)
      ]);
      const funding = numeric(premium.lastFundingRate);
      const mark = numeric(premium.markPrice);
      const nextMs = numeric(premium.nextFundingTime);
      const openInterest = numeric(oi.openInterest);
      const skew = numeric(skewRows[0]?.longShortRatio);
      metrics.push({
        venue: 'binance',
        market,
        symbol,
        funding_rate: funding,
        funding_rate_bps: funding === null ? null : funding * 10000,
        funding_interval_hours: 8,
        next_funding_time: iso(nextMs),
        time_to_next_seconds: secondsUntil(nextMs),
        open_interest: openInterest,
        open_interest_usd: openInterest !== null && mark !== null ? openInterest * mark : null,
        mark_price: mark,
        index_price: numeric(premium.indexPrice),
        skew,
        skew_source: skew === null ? null : 'binance:globalLongShortAccountRatio:5m',
        source_timestamp: iso(numeric(premium.time) ?? numeric(oi.time) ?? numeric(skewRows[0]?.timestamp)),
        data_source: 'binance:fapi',
        raw: includeRaw ? { premium, oi, skew: skewRows[0] } : undefined
      });
    } catch (error) {
      warnings.push(`binance:${symbol} ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { metrics, warnings };
}

export async function fetchBybit(markets: string[], includeRaw = false): Promise<{ metrics: FundingMetric[]; warnings: string[] }> {
  const warnings: string[] = [];
  const metrics: FundingMetric[] = [];
  for (const marketInput of markets) {
    const market = normalizeMarket(marketInput);
    const symbol = binanceSymbol(market);
    try {
      const payload = await fetchJson<{ retCode: number; retMsg: string; result?: { list?: BybitTicker[] } }>(`${BYBIT_API}/v5/market/tickers?category=linear&symbol=${encodeURIComponent(symbol)}`, undefined, 5000, 2);
      if (payload.retCode !== 0) throw new Error(payload.retMsg || `retCode ${payload.retCode}`);
      const ticker = payload.result?.list?.[0];
      if (!ticker) throw new Error('empty ticker list');
      const funding = numeric(ticker.fundingRate);
      const nextMs = numeric(ticker.nextFundingTime);
      metrics.push({
        venue: 'bybit',
        market,
        symbol,
        funding_rate: funding,
        funding_rate_bps: funding === null ? null : funding * 10000,
        funding_interval_hours: numeric(ticker.fundingIntervalHour),
        next_funding_time: iso(nextMs),
        time_to_next_seconds: secondsUntil(nextMs),
        open_interest: numeric(ticker.openInterest),
        open_interest_usd: numeric(ticker.openInterestValue),
        mark_price: numeric(ticker.markPrice),
        index_price: numeric(ticker.indexPrice),
        skew: null,
        skew_source: null,
        source_timestamp: null,
        data_source: 'bybit:v5:market:tickers',
        raw: includeRaw ? ticker : undefined
      });
    } catch (error) {
      warnings.push(`bybit:${symbol} ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (metrics.length > 0) warnings.push('bybit ticker endpoint does not expose public long/short skew; skew is null.');
  return { metrics, warnings };
}

export async function fetchVenue(venue: VenueId, markets: string[], includeRaw = false): Promise<{ metrics: FundingMetric[]; warnings: string[] }> {
  if (venue === 'hyperliquid') return fetchHyperliquid(markets, includeRaw);
  if (venue === 'binance') return fetchBinance(markets, includeRaw);
  return fetchBybit(markets, includeRaw);
}

export const testInternals = { normalizeMarket, numeric, secondsUntil, iso };
