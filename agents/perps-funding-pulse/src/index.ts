import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "1.0.0",
  description:
    "Fetch current funding rate, next tick, and open interest per perpetual futures market from major venues (Hyperliquid, dYdX, GMX).",
});

// ─── Venue fetchers ───────────────────────────────────────────────────

interface VenueResult {
  venue: string;
  market: string;
  funding_rate: number;
  time_to_next: string;
  open_interest: number;
  skew: number;
}

/** Hyperliquid – public info endpoint (no key needed) */
async function fetchHyperliquid(markets: string[]): Promise<VenueResult[]> {
  try {
    const resp = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    const data = (await resp.json()) as any;
    if (!Array.isArray(data) || data.length < 2) return [];

    const meta = data[0]; // meta.universe = asset list
    const ctxs = data[1]; // per-asset context

    const results: VenueResult[] = [];
    const assets: any[] = meta?.universe ?? [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const ctx = ctxs[i];
      if (!asset || !ctx) continue;

      const symbol = asset.name;
      // filter if markets specified
      if (
        markets.length > 0 &&
        !markets.some(
          (m) => m.toUpperCase() === symbol.toUpperCase()
        )
      )
        continue;

      const fundingRate = parseFloat(ctx.funding ?? "0");
      const openInterest = parseFloat(ctx.openInterest ?? "0") * parseFloat(ctx.markPx ?? "1");

      // Hyperliquid funding is per 1h, next funding at next whole hour
      const now = Date.now();
      const nextHour = Math.ceil(now / 3600000) * 3600000;
      const msLeft = nextHour - now;
      const minsLeft = Math.floor(msLeft / 60000);

      // long/short skew: derive from funding sign
      // positive funding → longs pay shorts → more longs than shorts
      const skew = fundingRate > 0 ? 1 + fundingRate * 100 : 1 / (1 + Math.abs(fundingRate) * 100);

      results.push({
        venue: "Hyperliquid",
        market: symbol,
        funding_rate: parseFloat((fundingRate * 24 * 365 * 100).toFixed(4)), // annualised %
        time_to_next: `${minsLeft}m`,
        open_interest: parseFloat(openInterest.toFixed(2)),
        skew: parseFloat(skew.toFixed(4)),
      });
    }
    return results;
  } catch {
    return [];
  }
}

/** dYdX v4 – public indexer */
async function fetchDydx(markets: string[]): Promise<VenueResult[]> {
  try {
    const resp = await fetch(
      "https://indexer.dydx.trade/v4/perpetualMarkets"
    );
    const json = (await resp.json()) as any;
    const marketsData = json?.markets ?? {};

    const results: VenueResult[] = [];
    for (const [symbol, m] of Object.entries(marketsData) as [string, any][]) {
      if (
        markets.length > 0 &&
        !markets.some(
          (mk) => mk.toUpperCase() === symbol.toUpperCase()
        )
      )
        continue;

      const fundingRate = parseFloat(m.nextFundingRate ?? "0");
      const openInterest = parseFloat(m.openInterest ?? "0");
      const nextFundingTime = m.nextFundingTime ?? "";

      let timeToNext = "N/A";
      if (nextFundingTime) {
        const diff = new Date(nextFundingTime).getTime() - Date.now();
        if (diff > 0) {
          const hrs = Math.floor(diff / 3600000);
          const mins = Math.floor((diff % 3600000) / 60000);
          timeToNext = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
        }
      }

      const skew = fundingRate > 0 ? 1 + fundingRate * 100 : 1 / (1 + Math.abs(fundingRate) * 100);

      results.push({
        venue: "dYdX",
        market: symbol,
        funding_rate: parseFloat((fundingRate * 24 * 365 * 100).toFixed(4)),
        time_to_next: timeToNext,
        open_interest: parseFloat(openInterest.toFixed(2)),
        skew: parseFloat(skew.toFixed(4)),
      });
    }
    return results;
  } catch {
    return [];
  }
}

/** Binance perps – public */
async function fetchBinance(markets: string[]): Promise<VenueResult[]> {
  try {
    const resp = await fetch(
      "https://fapi.binance.com/fapi/v1/premiumIndex"
    );
    const data = (await resp.json()) as any[];
    if (!Array.isArray(data)) return [];

    const results: VenueResult[] = [];
    for (const item of data) {
      const symbol: string = item.symbol;
      if (
        markets.length > 0 &&
        !markets.some(
          (m) => m.toUpperCase() === symbol.toUpperCase()
        )
      )
        continue;

      const fundingRate = parseFloat(item.lastFundingRate ?? "0");
      const nextFundingTime = parseInt(item.nextFundingTime ?? "0");
      const openInterest = parseFloat(item.openInterest ?? "0") * parseFloat(item.markPrice ?? "0");

      const msLeft = nextFundingTime - Date.now();
      const minsLeft = Math.max(0, Math.floor(msLeft / 60000));
      const skew = fundingRate > 0 ? 1 + fundingRate * 100 : 1 / (1 + Math.abs(fundingRate) * 100);

      results.push({
        venue: "Binance",
        market: symbol,
        funding_rate: parseFloat((fundingRate * 3 * 365 * 100).toFixed(4)), // Binance: 8h funding → 3x/day
        time_to_next: `${minsLeft}m`,
        open_interest: parseFloat(openInterest.toFixed(2)),
        skew: parseFloat(skew.toFixed(4)),
      });
    }
    return results.slice(0, 50); // cap
  } catch {
    return [];
  }
}

// ─── entrypoint ───────────────────────────────────────────────────────

addEntrypoint({
  key: "funding-pulse",
  description:
    "Return live funding metrics (rate, time-to-next, OI, skew) for perpetual futures markets across Hyperliquid, dYdX, and Binance.",
  input: z.object({
    venue_ids: z
      .array(z.enum(["hyperliquid", "dydx", "binance"]))
      .default(["hyperliquid", "dydx", "binance"])
      .describe("Perpetual exchanges to query"),
    markets: z
      .array(z.string())
      .default([])
      .describe(
        "Specific markets to track, e.g. ['BTC', 'ETH']. Empty = all."
      ),
  }),

  async handler({ input }) {
    const { venue_ids, markets } = input;

    const fetchers: Record<string, () => Promise<VenueResult[]>> = {
      hyperliquid: () => fetchHyperliquid(markets),
      dydx: () => fetchDydx(markets),
      binance: () => fetchBinance(markets),
    };

    const settled = await Promise.allSettled(
      venue_ids.map((v) => fetchers[v]())
    );

    const allResults: VenueResult[] = settled
      .filter(
        (r): r is PromiseFulfilledResult<VenueResult[]> =>
          r.status === "fulfilled"
      )
      .flatMap((r) => r.value);

    return {
      output: {
        results: allResults,
        venues_queried: venue_ids,
        markets_filtered: markets.length > 0 ? markets : "all",
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: allResults.length * 10 },
    };
  },
});

export default app;
