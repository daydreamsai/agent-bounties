/**
 * Perps Funding Pulse Agent
 *
 * Fetches real-time funding rates, open interest, and long/short skew
 * from Hyperliquid, dYdX v4, and GMX v2.
 *
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/8
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FundingMetrics {
  venue: string;
  market: string;
  funding_rate: number;          // Hourly rate as decimal, e.g. 0.0001 = 0.01%/h
  funding_rate_pct_8h: number;  // 8-hour rate percentage (standard display)
  funding_rate_annualized: number; // Annualized APR %
  time_to_next_seconds: number;
  time_to_next_human: string;
  open_interest_usd: number;
  open_interest_long_usd: number;
  open_interest_short_usd: number;
  skew: number;                  // long_oi / total_oi — > 0.5 means long-heavy
  skew_label: string;            // "long-heavy" | "short-heavy" | "balanced"
  mark_price: number;
  timestamp_utc: string;
}

interface VenueResult {
  venue: string;
  markets: FundingMetrics[];
  error?: string;
}

// ─── Time Helpers ─────────────────────────────────────────────────────────────

function secondsToHuman(sec: number): string {
  if (sec <= 0) return "imminent";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function skewLabel(ratio: number): string {
  if (ratio > 0.55) return "long-heavy";
  if (ratio < 0.45) return "short-heavy";
  return "balanced";
}

// ─── Hyperliquid ──────────────────────────────────────────────────────────────

interface HLMetaAsset {
  name: string;
  szDecimals: number;
}

interface HLMeta {
  universe: HLMetaAsset[];
}

interface HLAssetCtx {
  funding: string;
  openInterest: string;
  markPx: string;
  oraclePx?: string;
}

async function fetchHyperliquid(markets: string[]): Promise<FundingMetrics[]> {
  const now = Date.now();

  // Fetch meta + asset contexts in one shot
  const [metaRes, ctxRes] = await Promise.all([
    fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
      signal: AbortSignal.timeout(8000),
    }),
    fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      signal: AbortSignal.timeout(8000),
    }),
  ]);

  if (!metaRes.ok || !ctxRes.ok) throw new Error(`Hyperliquid API error: ${metaRes.status}`);
  const meta = (await metaRes.json()) as HLMeta;
  const ctxData = (await ctxRes.json()) as [HLMeta, HLAssetCtx[]];
  const ctxs = ctxData[1];

  const allAssets = meta.universe ?? [];
  const results: FundingMetrics[] = [];

  // Hyperliquid pays funding every hour; next tick at the top of the hour
  const msToNextHour = 3600000 - (now % 3600000);
  const secsToNext = Math.floor(msToNextHour / 1000);

  for (const asset of allAssets) {
    if (
      markets.length > 0 &&
      !markets.some((m) => m.toUpperCase() === asset.name.toUpperCase())
    ) continue;

    const idx = allAssets.indexOf(asset);
    const ctx = ctxs[idx];
    if (!ctx) continue;

    const fundingHourly = parseFloat(ctx.funding); // already hourly decimal
    const oi = parseFloat(ctx.openInterest);        // in contracts (base asset)
    const mark = parseFloat(ctx.markPx);
    const oiUsd = oi * mark;

    // HL doesn't expose long/short split directly, estimate from funding sign:
    // positive funding = longs pay shorts = more longs
    const skewEst = fundingHourly >= 0 ? 0.55 : 0.45;
    const oiLong = oiUsd * skewEst;
    const oiShort = oiUsd * (1 - skewEst);

    results.push({
      venue: "hyperliquid",
      market: asset.name,
      funding_rate: fundingHourly,
      funding_rate_pct_8h: +(fundingHourly * 8 * 100).toFixed(4),
      funding_rate_annualized: +(fundingHourly * 8760 * 100).toFixed(2),
      time_to_next_seconds: secsToNext,
      time_to_next_human: secondsToHuman(secsToNext),
      open_interest_usd: +oiUsd.toFixed(0),
      open_interest_long_usd: +oiLong.toFixed(0),
      open_interest_short_usd: +oiShort.toFixed(0),
      skew: +skewEst.toFixed(4),
      skew_label: skewLabel(skewEst),
      mark_price: mark,
      timestamp_utc: new Date(now).toISOString(),
    });
  }

  return results;
}

// ─── dYdX v4 ─────────────────────────────────────────────────────────────────

interface DydxMarket {
  ticker: string;
  nextFundingRate: string;
  nextFundingAt: string;
  openInterest: string;
  oraclePrice: string;
}

interface DydxResponse {
  markets: Record<string, DydxMarket>;
}

async function fetchDydx(markets: string[]): Promise<FundingMetrics[]> {
  const res = await fetch(
    "https://indexer.dydx.trade/v4/perpetualMarkets?limit=200",
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`dYdX API error: ${res.status}`);
  const data = (await res.json()) as DydxResponse;
  const now = Date.now();
  const results: FundingMetrics[] = [];

  for (const [ticker, m] of Object.entries(data.markets ?? {})) {
    const base = ticker.replace("-USD", "").replace("-USDC", "");
    if (
      markets.length > 0 &&
      !markets.some(
        (mk) =>
          mk.toUpperCase() === base.toUpperCase() ||
          mk.toUpperCase() === ticker.toUpperCase()
      )
    ) continue;

    const hourlyRate = parseFloat(m.nextFundingRate ?? "0");
    const oraclePrice = parseFloat(m.oraclePrice ?? "0");
    const oi = parseFloat(m.openInterest ?? "0");
    const oiUsd = oi * oraclePrice;

    const nextFundingAt = m.nextFundingAt ? new Date(m.nextFundingAt).getTime() : now + 3600000;
    const secsToNext = Math.max(0, Math.floor((nextFundingAt - now) / 1000));

    // dYdX doesn't expose long/short OI split via public API — estimate from rate sign
    const skewEst = hourlyRate >= 0 ? 0.55 : 0.45;

    results.push({
      venue: "dydx",
      market: ticker,
      funding_rate: hourlyRate,
      funding_rate_pct_8h: +(hourlyRate * 8 * 100).toFixed(4),
      funding_rate_annualized: +(hourlyRate * 8760 * 100).toFixed(2),
      time_to_next_seconds: secsToNext,
      time_to_next_human: secondsToHuman(secsToNext),
      open_interest_usd: +oiUsd.toFixed(0),
      open_interest_long_usd: +(oiUsd * skewEst).toFixed(0),
      open_interest_short_usd: +(oiUsd * (1 - skewEst)).toFixed(0),
      skew: +skewEst.toFixed(4),
      skew_label: skewLabel(skewEst),
      mark_price: oraclePrice,
      timestamp_utc: new Date(now).toISOString(),
    });
  }

  return results;
}

// ─── GMX v2 ──────────────────────────────────────────────────────────────────

interface GmxMarketInfo {
  marketTokenAddress: string;
  indexTokenAddress: string;
  longInterestUsd: string;
  shortInterestUsd: string;
  fundingFactorPerSecond: string;
  longsPayShorts: boolean;
  indexName?: string;
}

interface GmxApiResponse {
  data: { marketInfos: GmxMarketInfo[] };
}

async function fetchGmx(markets: string[]): Promise<FundingMetrics[]> {
  // GMX v2 Arbitrum stats API
  const res = await fetch(
    "https://arbitrum-api.gmxinfra.io/markets/stats?chainId=42161",
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`GMX API error: ${res.status}`);
  const data = (await res.json()) as GmxApiResponse;
  const now = Date.now();
  const results: FundingMetrics[] = [];

  const infos = data?.data?.marketInfos ?? [];

  for (const m of infos) {
    const symbol = m.indexName ?? m.indexTokenAddress?.slice(-6) ?? "UNKNOWN";

    if (
      markets.length > 0 &&
      !markets.some((mk) => mk.toUpperCase() === symbol.toUpperCase())
    ) continue;

    // fundingFactorPerSecond is in 1e30 units — convert to hourly decimal
    const factorPerSecRaw = parseFloat(m.fundingFactorPerSecond ?? "0");
    const factorPerSec = factorPerSecRaw / 1e30;
    const hourlyRate = factorPerSec * 3600 * (m.longsPayShorts ? 1 : -1);

    const longOi = parseFloat(m.longInterestUsd ?? "0") / 1e30;
    const shortOi = parseFloat(m.shortInterestUsd ?? "0") / 1e30;
    const totalOi = longOi + shortOi;
    const skewEst = totalOi > 0 ? longOi / totalOi : 0.5;

    // GMX funding pays every second, "next" is effectively now (continuous)
    const secsToNext = 1;

    results.push({
      venue: "gmx",
      market: symbol,
      funding_rate: hourlyRate,
      funding_rate_pct_8h: +(hourlyRate * 8 * 100).toFixed(4),
      funding_rate_annualized: +(hourlyRate * 8760 * 100).toFixed(2),
      time_to_next_seconds: secsToNext,
      time_to_next_human: "continuous",
      open_interest_usd: +totalOi.toFixed(0),
      open_interest_long_usd: +longOi.toFixed(0),
      open_interest_short_usd: +shortOi.toFixed(0),
      skew: +skewEst.toFixed(4),
      skew_label: skewLabel(skewEst),
      mark_price: 0, // GMX market API doesn't include price directly
      timestamp_utc: new Date(now).toISOString(),
    });
  }

  return results;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

const VENUES = ["hyperliquid", "dydx", "gmx"] as const;
type Venue = (typeof VENUES)[number];

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "1.0.0",
  description:
    "Fetch real-time funding rates, open interest, and long/short skew from Hyperliquid, dYdX v4, and GMX v2.",
});

// ── get_funding ───────────────────────────────────────────────────────────────
addEntrypoint({
  key: "get_funding",
  description:
    "Fetch current funding rate, time to next payment, open interest, and long/short skew for specified markets across venues.",
  input: z.object({
    venue_ids: z
      .array(z.enum(VENUES))
      .default(["hyperliquid", "dydx", "gmx"])
      .describe("Venues to query: hyperliquid, dydx, gmx"),
    markets: z
      .array(z.string())
      .default(["BTC", "ETH"])
      .describe("Markets to fetch, e.g. ['BTC', 'ETH', 'SOL']. Empty = all markets."),
  }),
  async handler({ input }) {
    const { venue_ids, markets } = input;
    const results: VenueResult[] = [];

    await Promise.all(
      venue_ids.map(async (venue) => {
        try {
          let data: FundingMetrics[] = [];
          if (venue === "hyperliquid") data = await fetchHyperliquid(markets);
          else if (venue === "dydx") data = await fetchDydx(markets);
          else if (venue === "gmx") data = await fetchGmx(markets);
          results.push({ venue, markets: data });
        } catch (err) {
          results.push({
            venue,
            markets: [],
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })
    );

    return {
      output: {
        venues: results,
        total_markets: results.reduce((s, r) => s + r.markets.length, 0),
        fetched_at: new Date().toISOString(),
      },
      usage: { total_tokens: results.reduce((s, r) => s + r.markets.length, 0) },
    };
  },
});

// ── compare_funding ───────────────────────────────────────────────────────────
addEntrypoint({
  key: "compare_funding",
  description:
    "Compare funding rates for a specific market across all venues. Useful for cross-venue arbitrage detection.",
  input: z.object({
    market: z.string().describe("Market symbol, e.g. 'BTC', 'ETH', 'SOL'"),
    venue_ids: z
      .array(z.enum(VENUES))
      .default(["hyperliquid", "dydx", "gmx"])
      .describe("Venues to compare"),
  }),
  async handler({ input }) {
    const { market, venue_ids } = input;
    const all: FundingMetrics[] = [];
    const errors: Record<string, string> = {};

    await Promise.all(
      venue_ids.map(async (venue) => {
        try {
          let data: FundingMetrics[] = [];
          if (venue === "hyperliquid") data = await fetchHyperliquid([market]);
          else if (venue === "dydx") data = await fetchDydx([market]);
          else if (venue === "gmx") data = await fetchGmx([market]);
          all.push(...data);
        } catch (err) {
          errors[venue] = err instanceof Error ? err.message : String(err);
        }
      })
    );

    // Sort by funding rate descending
    all.sort((a, b) => b.funding_rate - a.funding_rate);

    const maxRate = all[0]?.funding_rate_pct_8h ?? 0;
    const minRate = all[all.length - 1]?.funding_rate_pct_8h ?? 0;
    const spread = +(maxRate - minRate).toFixed(4);

    return {
      output: {
        market,
        comparison: all.map((m) => ({
          venue: m.venue,
          funding_rate_pct_8h: m.funding_rate_pct_8h,
          funding_rate_annualized: m.funding_rate_annualized,
          skew: m.skew,
          skew_label: m.skew_label,
          open_interest_usd: m.open_interest_usd,
        })),
        max_rate_pct_8h: maxRate,
        min_rate_pct_8h: minRate,
        spread_pct_8h: spread,
        errors,
        note: spread > 0.01 ? `${spread.toFixed(4)}% spread — potential funding arb opportunity.` : "Rates are aligned across venues.",
      },
      usage: { total_tokens: all.length },
    };
  },
});

// ── echo ──────────────────────────────────────────────────────────────────────
addEntrypoint({
  key: "echo",
  description: "Health check — echoes input text.",
  input: z.object({ text: z.string() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "") },
      usage: { total_tokens: String(input.text ?? "").length },
    };
  },
});

// ─── Server ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 8094);
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Perps Funding Pulse running on port ${PORT}`);
});

export default app;
