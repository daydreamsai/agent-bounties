import { z } from "zod/v4";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint }: ReturnType<typeof createAgentApp> = createAgentApp(
  {
    name: "perps-funding-pulse",
    version: "0.1.0",
    description:
      "Track perpetual DEX funding rates (GMX/dYdX/Hyperliquid/Binance), identify arbitrage opportunities, historical rate analysis, extreme rate alerts",
  },
  {
    payments: false,
  }
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FundingData {
  funding_rate: number;
  time_to_next: string;
  open_interest: number;
  skew: number;
  market: string;
  venue: string;
}

export interface ArbitrageOpportunity {
  market: string;
  long_venue: string;
  short_venue: string;
  long_rate: number;
  short_rate: number;
  spread: number;
  annualized_spread_pct: number;
}

export interface AlertResult {
  market: string;
  venue: string;
  funding_rate: number;
  severity: "high" | "extreme";
  threshold_exceeded: number;
  message: string;
}

// ─── Symbol Normalization ─────────────────────────────────────────────────────

function normalizeSymbol(input: string): {
  binance: string;
  hyperliquid: string;
  dydx: string;
  gmx: string;
} {
  const s = input.toUpperCase().replace(/[-\/\s]/g, "");
  return {
    binance: s.endsWith("USDT") ? s : s + "USDT",
    hyperliquid: s.replace("USDT", "").replace("USD", ""),
    dydx: s.replace("USDT", "-USD").replace("-PERP", ""),
    gmx: s.replace("USDT", "/USD").replace("USD/USD", "USD"),
  };
}

// ─── Binance Futures ──────────────────────────────────────────────────────────

async function fetchBinanceFunding(symbol: string): Promise<FundingData | null> {
  try {
    const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      funding_rate: parseFloat(data.lastFundingRate || "0"),
      time_to_next: new Date(parseInt(data.nextFundingTime)).toISOString(),
      open_interest: 0,
      skew: 0,
      market: symbol.replace("USDT", "/USDT"),
      venue: "binance",
    };
  } catch {
    return null;
  }
}

async function fetchBinanceOI(symbol: string): Promise<number> {
  try {
    const url = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data = await res.json();
    return parseFloat(data.openInterest || "0");
  } catch {
    return 0;
  }
}

// ─── Hyperliquid ──────────────────────────────────────────────────────────────

let hlCache: { meta: any; assetCtxs: any } | null = null;
let hlCacheTime = 0;
const HL_CACHE_TTL = 30_000; // 30s cache

async function fetchHyperliquidFunding(coin: string): Promise<FundingData | null> {
  try {
    const now = Date.now();
    if (!hlCache || now - hlCacheTime > HL_CACHE_TTL) {
      const res = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      });
      if (!res.ok) return null;
      const json = await res.json() as any;
      const meta = json[0];
      const assetCtxs = json[1];
      hlCache = { meta, assetCtxs };
      hlCacheTime = now;
    }

    const { meta, assetCtxs } = hlCache!;
    const coinIndex = meta.universe.findIndex(
      (c: { name: string }) => c.name === coin
    );
    if (coinIndex === -1) return null;

    const ctx = assetCtxs[coinIndex];
    return {
      funding_rate: parseFloat(ctx.funding || "0"),
      time_to_next: ctx.nextFundingTime
        ? new Date(parseInt(ctx.nextFundingTime)).toISOString()
        : "unknown",
      open_interest: parseFloat(ctx.openInterest || "0"),
      skew: parseFloat(ctx.dayQtyFunding || "0"),
      market: `${coin}/USD`,
      venue: "hyperliquid",
    };
  } catch {
    return null;
  }
}

// ─── dYdX v4 ─────────────────────────────────────────────────────────────────

interface DydxMarket {
  ticker: string;
  nextFundingRate: string;
  openInterest: string;
}

let dydxCache: DydxMarket[] | null = null;
let dydxCacheTime = 0;
const DYDX_CACHE_TTL = 30_000;

async function fetchDydxFunding(market: string): Promise<FundingData | null> {
  try {
    const now = Date.now();
    if (!dydxCache || now - dydxCacheTime > DYDX_CACHE_TTL) {
      const res = await fetch(
        "https://indexer.dydx.trade/v4/perpetualMarkets"
      );
      if (!res.ok) return null;
      const data = await res.json();
      dydxCache = data.markets ? Object.values(data.markets) as DydxMarket[] : [];
      dydxCacheTime = now;
    }

    const match = dydxCache.find(
      (m: DydxMarket) =>
        m.ticker.toUpperCase() === market.toUpperCase()
    );
    if (!match) return null;

    const fundingRate = parseFloat(match.nextFundingRate) / 1e6; // dYdX stores as millionths
    return {
      funding_rate: fundingRate,
      time_to_next: "1h", // dYdX funds every hour
      open_interest: parseFloat(match.openInterest || "0"),
      skew: 0,
      market,
      venue: "dydx",
    };
  } catch {
    return null;
  }
}

// ─── GMX v2 (Arbitrum) ───────────────────────────────────────────────────────

// GMX v2 funding rates: we approximate by querying the Reader contract
// via a public RPC or subgraph. For simplicity, use the GMX v2 subgraph.
async function fetchGmxFunding(market: string): Promise<FundingData | null> {
  try {
    // GMX v2 data API endpoint (public REST)
    const url = "https://gmx-server-mainnet.chainbot.workers.dev/markets";
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    // Find matching market
    const match = data.markets?.find(
      (m: any) =>
        (m.indexToken?.symbol || "").toUpperCase() === market.toUpperCase()
    );
    if (!match) return null;

    const longRate = parseFloat(match.fundingRateLong || "0");
    const shortRate = parseFloat(match.fundingRateShort || "0");
    // GMX funding rate: positive = longs pay shorts
    const avgRate = (longRate + shortRate) / 2 / 1e30 * 3600; // Convert to hourly rate

    return {
      funding_rate: avgRate,
      time_to_next: "1h",
      open_interest: parseFloat(match.poolValueMax || "0"),
      skew: longRate - shortRate,
      market: `${market}/USD`,
      venue: "gmx",
    };
  } catch {
    return null;
  }
}

// ─── Core: Fetch all venues for a market ─────────────────────────────────────

async function fetchAllVenues(
  market: string,
  venues: string[]
): Promise<FundingData[]> {
  const symbols = normalizeSymbol(market);
  const results: FundingData[] = [];

  const fetchers: Record<string, () => Promise<FundingData | null>> = {
    binance: async () => {
      const [funding, oi] = await Promise.all([
        fetchBinanceFunding(symbols.binance),
        fetchBinanceOI(symbols.binance),
      ]);
      if (funding) {
        funding.open_interest = oi;
      }
      return funding;
    },
    hyperliquid: async () => fetchHyperliquidFunding(symbols.hyperliquid),
    dydx: async () => fetchDydxFunding(symbols.dydx),
    gmx: async () => fetchGmxFunding(symbols.gmx),
  };

  const tasks = venues
    .filter((v) => v in fetchers)
    .map(async (venue) => {
      const data = await fetchers[venue]();
      return data;
    });

  const fetched = await Promise.all(tasks);
  for (const data of fetched) {
    if (data) results.push(data);
  }

  return results;
}

// ─── Arbitrage Detection ─────────────────────────────────────────────────────

function detectArbitrage(data: FundingData[]): ArbitrageOpportunity[] {
  const byMarket = new Map<string, FundingData[]>();
  for (const d of data) {
    const key = d.market;
    if (!byMarket.has(key)) byMarket.set(key, []);
    byMarket.get(key)!.push(d);
  }

  const opportunities: ArbitrageOpportunity[] = [];

  byMarket.forEach((entries, market) => {
    if (entries.length < 2) return;

    // For each pair of venues on the same market
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        const spread = a.funding_rate - b.funding_rate;

        if (Math.abs(spread) > 0.000001) {
          // Determine direction: go long where rate is lower, short where higher
          const [long_venue, short_venue] =
            spread > 0
              ? [b, a] // b has lower rate = go long; a has higher = go short
              : [a, b]; // a has lower rate = go long; b has higher = go short

          opportunities.push({
            market,
            long_venue: long_venue.venue,
            short_venue: short_venue.venue,
            long_rate: long_venue.funding_rate,
            short_rate: short_venue.funding_rate,
            spread: Math.abs(spread),
            annualized_spread_pct: Math.abs(spread) * 3 * 365 * 100, // 3 funding periods/day
          });
        }
      }
    }
  });

  // Sort by annualized spread descending
  opportunities.sort(
    (a, b) => b.annualized_spread_pct - a.annualized_spread_pct
  );

  return opportunities;
}

// ─── Extreme Rate Alerts ─────────────────────────────────────────────────────

interface AlertThresholds {
  high: number;
  extreme: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  high: 0.001, // 0.1%
  extreme: 0.005, // 0.5%
};

function detectExtremeRates(
  data: FundingData[],
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): AlertResult[] {
  const alerts: AlertResult[] = [];

  for (const entry of data) {
    const absRate = Math.abs(entry.funding_rate);
    let severity: AlertResult["severity"] | null = null;
    let thresholdExceeded = 0;

    if (absRate >= thresholds.extreme) {
      severity = "extreme";
      thresholdExceeded = thresholds.extreme;
    } else if (absRate >= thresholds.high) {
      severity = "high";
      thresholdExceeded = thresholds.high;
    }

    if (severity) {
      alerts.push({
        market: entry.market,
        venue: entry.venue,
        funding_rate: entry.funding_rate,
        severity,
        threshold_exceeded: thresholdExceeded,
        message: `${severity.toUpperCase()} funding rate on ${entry.market} @ ${entry.venue}: ${(entry.funding_rate * 100).toFixed(4)}% (threshold: ${thresholdExceeded * 100}%)`,
      });
    }
  }

  alerts.sort((a, b) => Math.abs(b.funding_rate) - Math.abs(a.funding_rate));
  return alerts;
}

// ─── Entrypoints ─────────────────────────────────────────────────────────────

// Main entrypoint: batch funding data
addEntrypoint({
  key: "funding",
  description:
    "Fetch current funding rate, next tick, open interest, and skew across perpetuals exchanges",
  input: z.object({
    venue_ids: z
      .array(z.string())
      .optional()
      .describe("Perpetuals exchanges to query (binance, hyperliquid, dydx, gmx)"),
    markets: z
      .array(z.string())
      .optional()
      .describe("Specific markets to track (e.g. BTC, ETH, SOL)"),
  }),
  async handler({ input }) {
    const venues = input.venue_ids ?? [
      "binance",
      "hyperliquid",
      "dydx",
      "gmx",
    ];
    const markets = input.markets ?? ["BTC", "ETH", "SOL"];
    const results: FundingData[] = [];

    for (const market of markets) {
      const data = await fetchAllVenues(market, venues);
      results.push(...data);
    }

    return {
      output: {
        results,
        count: results.length,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: JSON.stringify(results).length },
    };
  },
});

// Quick lookup: single market, single venue
addEntrypoint({
  key: "quick",
  description: "Quick funding rate lookup for a single market",
  input: z.object({
    market: z.string().describe("Market symbol (e.g. BTC, ETH)"),
    venue: z
      .string()
      .optional()
      .describe("Exchange to query (default: binance)"),
  }),
  async handler({ input }) {
    const venue = input.venue ?? "binance";
    const results = await fetchAllVenues(input.market, [venue]);

    if (results.length === 0) {
      return {
        output: {
          error: `No data found for ${input.market} on ${venue}`,
        },
        usage: { total_tokens: 0 },
      };
    }

    return {
      output: results[0],
      usage: { total_tokens: JSON.stringify(results[0]).length },
    };
  },
});

// Arbitrage detection: find funding rate arbitrage opportunities
addEntrypoint({
  key: "arbitrage",
  description:
    "Detect funding rate arbitrage opportunities across venues — go long where funding rate is low, short where it's high",
  input: z.object({
    markets: z
      .array(z.string())
      .optional()
      .describe("Markets to scan (default: BTC, ETH, SOL, AVAX, LINK)"),
    venue_ids: z
      .array(z.string())
      .optional()
      .describe("Venues to compare (default: all)"),
    min_spread_pct: z
      .number()
      .optional()
      .describe("Minimum annualized spread % to report (default: 1.0)"),
  }),
  async handler({ input }) {
    const venues = input.venue_ids ?? [
      "binance",
      "hyperliquid",
      "dydx",
      "gmx",
    ];
    const markets = input.markets ?? ["BTC", "ETH", "SOL", "AVAX", "LINK"];
    const minSpreadPct = input.min_spread_pct ?? 1.0;

    const results: FundingData[] = [];
    for (const market of markets) {
      const data = await fetchAllVenues(market, venues);
      results.push(...data);
    }

    const opportunities = detectArbitrage(results).filter(
      (opp) => opp.annualized_spread_pct >= minSpreadPct
    );

    return {
      output: {
        opportunities,
        count: opportunities.length,
        timestamp: new Date().toISOString(),
        note: "Strategy: go LONG on the venue with lower funding rate, SHORT on the venue with higher funding rate.",
      },
      usage: { total_tokens: JSON.stringify(opportunities).length },
    };
  },
});

// Extreme rate alerts
addEntrypoint({
  key: "alerts",
  description: "Detect extreme funding rates that signal market stress or opportunities",
  input: z.object({
    markets: z
      .array(z.string())
      .optional()
      .describe("Markets to check (default: BTC, ETH, SOL)"),
    venue_ids: z
      .array(z.string())
      .optional()
      .describe("Venues to check (default: all)"),
    high_threshold: z
      .number()
      .optional()
      .describe("High alert threshold as fraction (default: 0.001 = 0.1%)"),
    extreme_threshold: z
      .number()
      .optional()
      .describe("Extreme alert threshold as fraction (default: 0.005 = 0.5%)"),
  }),
  async handler({ input }) {
    const venues = input.venue_ids ?? [
      "binance",
      "hyperliquid",
      "dydx",
      "gmx",
    ];
    const markets = input.markets ?? ["BTC", "ETH", "SOL"];

    const thresholds: AlertThresholds = {
      high: input.high_threshold ?? DEFAULT_THRESHOLDS.high,
      extreme: input.extreme_threshold ?? DEFAULT_THRESHOLDS.extreme,
    };

    const results: FundingData[] = [];
    for (const market of markets) {
      const data = await fetchAllVenues(market, venues);
      results.push(...data);
    }

    const alerts = detectExtremeRates(results, thresholds);

    return {
      output: {
        alerts,
        count: alerts.length,
        thresholds,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: JSON.stringify(alerts).length },
    };
  },
});

// Historical comparison: fetch and compare with cached previous state
const historyStore = new Map<string, { rate: number; timestamp: string }>();

addEntrypoint({
  key: "history",
  description:
    "Compare current funding rates with previous snapshot to detect trends",
  input: z.object({
    markets: z
      .array(z.string())
      .optional()
      .describe("Markets to track (default: BTC, ETH)"),
    venue_ids: z
      .array(z.string())
      .optional()
      .describe("Venues to check (default: binance, hyperliquid)"),
  }),
  async handler({ input }) {
    const venues = input.venue_ids ?? ["binance", "hyperliquid"];
    const markets = input.markets ?? ["BTC", "ETH"];

    const current: FundingData[] = [];
    for (const market of markets) {
      const data = await fetchAllVenues(market, venues);
      current.push(...data);
    }

    const comparisons: Array<{
      market: string;
      venue: string;
      current_rate: number;
      previous_rate: number | null;
      change: number | null;
      trend: "up" | "down" | "flat" | "new";
    }> = [];

    for (const entry of current) {
      const key = `${entry.venue}:${entry.market}`;
      const prev = historyStore.get(key);

      if (!prev) {
        comparisons.push({
          market: entry.market,
          venue: entry.venue,
          current_rate: entry.funding_rate,
          previous_rate: null,
          change: null,
          trend: "new",
        });
      } else {
        const change = entry.funding_rate - prev.rate;
        comparisons.push({
          market: entry.market,
          venue: entry.venue,
          current_rate: entry.funding_rate,
          previous_rate: prev.rate,
          change,
          trend:
            Math.abs(change) < 0.00001
              ? "flat"
              : change > 0
                ? "up"
                : "down",
        });
      }

      // Update store
      historyStore.set(key, {
        rate: entry.funding_rate,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      output: {
        comparisons,
        count: comparisons.length,
        snapshot_timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: JSON.stringify(comparisons).length },
    };
  },
});

// Health endpoint is auto-generated by agent-kit

export default app;
