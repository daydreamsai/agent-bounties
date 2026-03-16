/**
 * Perps Funding Pulse Agent
 *
 * Fetches current funding rates, open interest, and funding timing from
 * major perpetual futures venues. Supports Binance, Bybit, dYdX, Hyperliquid, OKX.
 *
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/8
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FundingData {
  venue: string;
  market: string;
  funding_rate: number;
  funding_rate_annual_pct: number;
  time_to_next_ms: number;
  time_to_next_human: string;
  open_interest: number;
  open_interest_usd: number;
  mark_price: number;
  skew: number | null;
  long_short_ratio: number | null;
  timestamp_ms: number;
}

// ─── Venue Fetchers ───────────────────────────────────────────────────────────

async function fetchBinance(markets: string[]): Promise<FundingData[]> {
  const results: FundingData[] = [];
  const now = Date.now();

  for (const market of markets) {
    // Binance uses BTCUSDT format
    const symbol = market.replace("-", "").replace("/", "");
    try {
      const [premiumRes, oiRes, lsrRes] = await Promise.allSettled([
        fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
        fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`),
        fetch(
          `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`
        ),
      ]);

      if (premiumRes.status !== "fulfilled" || !premiumRes.value.ok) continue;

      const premium = await premiumRes.value.json();
      const fundingRate = parseFloat(premium.lastFundingRate || "0");
      const markPrice = parseFloat(premium.markPrice || "0");
      const nextFundingTime = parseInt(premium.nextFundingTime || "0");

      let openInterest = 0;
      if (oiRes.status === "fulfilled" && oiRes.value.ok) {
        const oi = await oiRes.value.json();
        openInterest = parseFloat(oi.openInterest || "0");
      }

      let lsRatio: number | null = null;
      let skew: number | null = null;
      if (lsrRes.status === "fulfilled" && lsrRes.value.ok) {
        const lsrData = await lsrRes.value.json();
        if (Array.isArray(lsrData) && lsrData.length > 0) {
          lsRatio = parseFloat(lsrData[0].longShortRatio || "1");
          // skew: positive = more longs, negative = more shorts
          skew = (lsRatio - 1) / (lsRatio + 1);
        }
      }

      const timeToNext = nextFundingTime - now;
      results.push({
        venue: "BINANCE",
        market,
        funding_rate: fundingRate,
        funding_rate_annual_pct: fundingRate * 3 * 365 * 100, // 8h payments
        time_to_next_ms: Math.max(0, timeToNext),
        time_to_next_human: msToHuman(Math.max(0, timeToNext)),
        open_interest: openInterest,
        open_interest_usd: openInterest * markPrice,
        mark_price: markPrice,
        skew,
        long_short_ratio: lsRatio,
        timestamp_ms: now,
      });
    } catch {
      // skip on error
    }
  }

  return results;
}

async function fetchBybit(markets: string[]): Promise<FundingData[]> {
  const results: FundingData[] = [];
  const now = Date.now();

  for (const market of markets) {
    const symbol = market.replace("-", "").replace("/", "");
    try {
      const res = await fetch(
        `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`
      );
      if (!res.ok) continue;

      const data = await res.json();
      const list = data?.result?.list;
      if (!Array.isArray(list) || list.length === 0) continue;

      const ticker = list[0];
      const fundingRate = parseFloat(ticker.fundingRate || "0");
      const nextFundingTime = parseInt(ticker.nextFundingTime || "0");
      const markPrice = parseFloat(ticker.markPrice || "0");
      const openInterest = parseFloat(ticker.openInterestValue || "0") / markPrice;

      results.push({
        venue: "BYBIT",
        market,
        funding_rate: fundingRate,
        funding_rate_annual_pct: fundingRate * 3 * 365 * 100,
        time_to_next_ms: Math.max(0, nextFundingTime - now),
        time_to_next_human: msToHuman(Math.max(0, nextFundingTime - now)),
        open_interest: openInterest,
        open_interest_usd: parseFloat(ticker.openInterestValue || "0"),
        mark_price: markPrice,
        skew: null,
        long_short_ratio: null,
        timestamp_ms: now,
      });
    } catch {
      // skip on error
    }
  }

  return results;
}

async function fetchHyperliquid(markets: string[]): Promise<FundingData[]> {
  const results: FundingData[] = [];
  const now = Date.now();

  try {
    // Hyperliquid returns all markets in one request
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    if (!res.ok) return results;

    const [meta, ctxs] = await res.json();
    const assets: string[] = meta.universe.map((u: { name: string }) => u.name);

    for (const market of markets) {
      const base = market.split("-")[0].split("/")[0].toUpperCase();
      const idx = assets.indexOf(base);
      if (idx === -1) continue;

      const ctx = ctxs[idx];
      const fundingRate = parseFloat(ctx.funding || "0");
      const markPrice = parseFloat(ctx.markPx || "0");
      const openInterest = parseFloat(ctx.openInterest || "0");

      // Funding paid every hour on Hyperliquid
      const nextFundingMs = 3600000 - (now % 3600000);

      results.push({
        venue: "HYPERLIQUID",
        market,
        funding_rate: fundingRate,
        funding_rate_annual_pct: fundingRate * 24 * 365 * 100, // hourly payments
        time_to_next_ms: nextFundingMs,
        time_to_next_human: msToHuman(nextFundingMs),
        open_interest: openInterest,
        open_interest_usd: openInterest * markPrice,
        mark_price: markPrice,
        skew: null,
        long_short_ratio: null,
        timestamp_ms: now,
      });
    }
  } catch {
    // skip on error
  }

  return results;
}

async function fetchOKX(markets: string[]): Promise<FundingData[]> {
  const results: FundingData[] = [];
  const now = Date.now();

  for (const market of markets) {
    const [base, quote = "USDT"] = market.replace("/", "-").split("-");
    const instId = `${base}-${quote}-SWAP`;

    try {
      const [fundingRes, oiRes] = await Promise.allSettled([
        fetch(
          `https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`
        ),
        fetch(`https://www.okx.com/api/v5/public/open-interest?instId=${instId}`),
      ]);

      if (fundingRes.status !== "fulfilled" || !fundingRes.value.ok) continue;

      const fundingData = await fundingRes.value.json();
      const fd = fundingData?.data?.[0];
      if (!fd) continue;

      const fundingRate = parseFloat(fd.fundingRate || "0");
      const nextFundingTime = parseInt(fd.nextFundingTime || "0");
      const markPrice = parseFloat(fd.markPrice || "0");

      let openInterest = 0;
      if (oiRes.status === "fulfilled" && oiRes.value.ok) {
        const oiData = await oiRes.value.json();
        const oi = oiData?.data?.[0];
        if (oi) {
          openInterest = parseFloat(oi.oiCcy || "0");
        }
      }

      results.push({
        venue: "OKX",
        market,
        funding_rate: fundingRate,
        funding_rate_annual_pct: fundingRate * 3 * 365 * 100,
        time_to_next_ms: Math.max(0, nextFundingTime - now),
        time_to_next_human: msToHuman(Math.max(0, nextFundingTime - now)),
        open_interest: openInterest,
        open_interest_usd: openInterest * markPrice,
        mark_price: markPrice,
        skew: null,
        long_short_ratio: null,
        timestamp_ms: now,
      });
    } catch {
      // skip on error
    }
  }

  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msToHuman(ms: number): string {
  if (ms <= 0) return "imminent";
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ${mins % 60}m ${secs % 60}s`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

const VENUE_FETCHERS: Record<
  string,
  (markets: string[]) => Promise<FundingData[]>
> = {
  BINANCE: fetchBinance,
  BYBIT: fetchBybit,
  HYPERLIQUID: fetchHyperliquid,
  OKX: fetchOKX,
};

// ─── Agent App ────────────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "1.0.0",
  description:
    "Fetch current funding rate, next tick, open interest, and long/short skew for perpetual futures markets across major venues.",
});

addEntrypoint({
  key: "fetch_funding",
  description:
    "Return live funding metrics (funding_rate, time_to_next, open_interest, skew) for specified perpetuals markets across one or more venues.",
  input: z.object({
    venue_ids: z
      .array(z.enum(["BINANCE", "BYBIT", "HYPERLIQUID", "OKX"]))
      .default(["BINANCE", "BYBIT", "HYPERLIQUID", "OKX"])
      .describe("List of venues to query"),
    markets: z
      .array(z.string())
      .default(["BTC-USDT", "ETH-USDT"])
      .describe(
        "Markets to query, e.g. ['BTC-USDT', 'ETH-USDT', 'SOL-USDT']"
      ),
  }),
  async handler({ input }) {
    const venues = input.venue_ids ?? ["BINANCE", "BYBIT", "HYPERLIQUID", "OKX"];
    const markets = input.markets ?? ["BTC-USDT", "ETH-USDT"];

    const allResults = await Promise.allSettled(
      venues.map((venue) => {
        const fetcher = VENUE_FETCHERS[venue];
        return fetcher ? fetcher(markets) : Promise.resolve([]);
      })
    );

    const data: FundingData[] = allResults
      .filter((r): r is PromiseFulfilledResult<FundingData[]> => r.status === "fulfilled")
      .flatMap((r) => r.value);

    // Build summary per market across venues
    const summary: Record<
      string,
      {
        avg_funding_rate: number;
        max_funding_rate: number;
        min_funding_rate: number;
        highest_venue: string;
        lowest_venue: string;
      }
    > = {};

    for (const market of markets) {
      const marketData = data.filter((d) => d.market === market);
      if (marketData.length === 0) continue;

      const rates = marketData.map((d) => d.funding_rate);
      const maxIdx = rates.indexOf(Math.max(...rates));
      const minIdx = rates.indexOf(Math.min(...rates));

      summary[market] = {
        avg_funding_rate: rates.reduce((a, b) => a + b, 0) / rates.length,
        max_funding_rate: Math.max(...rates),
        min_funding_rate: Math.min(...rates),
        highest_venue: marketData[maxIdx].venue,
        lowest_venue: marketData[minIdx].venue,
      };
    }

    return {
      output: {
        data,
        summary,
        venues_queried: venues,
        markets_queried: markets,
        fetched_at: new Date().toISOString(),
      },
      usage: {
        total_tokens: String(data.length),
      },
    };
  },
});

// Backward-compatible "echo" entrypoint
addEntrypoint({
  key: "echo",
  description: "Echo a message (health check)",
  input: z.object({ text: z.string().optional() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "perps-funding-pulse online") },
      usage: { total_tokens: String((input.text ?? "").length) },
    };
  },
});

// Start HTTP server on port 8081 (8080 is used by service API)
const PORT = parseInt(process.env.PORT ?? "8081");
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Perps Funding Pulse agent running on http://0.0.0.0:${info.port}`);
});

export default app;
