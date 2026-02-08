import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "1.0.0",
  description: "Track perpetual futures funding rates across venues",
});

// Fetch funding rates from public APIs
async function fetchBinanceFunding(symbol: string): Promise<any> {
  const res = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`);
  return res.json();
}

async function fetchBybitFunding(symbol: string): Promise<any> {
  const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`);
  const data = await res.json();
  return data?.result?.list?.[0];
}

addEntrypoint({
  key: "monitor",
  description: "Track funding rates for perpetual markets",
  input: z.object({
    venue_ids: z.array(z.string()).optional().default(["binance", "bybit"]),
    markets: z.array(z.string()).optional().default(["BTCUSDT", "ETHUSDT"]),
  }),
  output: z.object({
    rates: z.array(z.object({
      venue: z.string(),
      market: z.string(),
      funding_rate: z.number(),
      funding_rate_pct: z.string(),
      next_funding_time: z.string(),
      time_to_next_minutes: z.number(),
      open_interest: z.string(),
      mark_price: z.string(),
      skew_hint: z.string(),
    })),
    arb_opportunities: z.array(z.object({
      market: z.string(),
      long_venue: z.string(),
      short_venue: z.string(),
      spread_bps: z.number(),
    })),
    summary: z.string(),
  }),
  async handler({ input }) {
    const venues = input.venue_ids ?? ["binance", "bybit"];
    const markets = input.markets ?? ["BTCUSDT", "ETHUSDT"];
    const rates: any[] = [];

    for (const market of markets) {
      for (const venue of venues) {
        try {
          if (venue === "binance") {
            const data = await fetchBinanceFunding(market);
            const fundingRate = parseFloat(data.lastFundingRate);
            const nextTime = new Date(data.nextFundingTime);
            const minutesToNext = Math.max(0, (nextTime.getTime() - Date.now()) / 60000);
            rates.push({
              venue: "binance",
              market,
              funding_rate: fundingRate,
              funding_rate_pct: (fundingRate * 100).toFixed(4) + "%",
              next_funding_time: nextTime.toISOString(),
              time_to_next_minutes: Math.round(minutesToNext),
              open_interest: "N/A",
              mark_price: data.markPrice,
              skew_hint: fundingRate > 0 ? "longs pay shorts" : "shorts pay longs",
            });
          } else if (venue === "bybit") {
            const data = await fetchBybitFunding(market);
            if (data) {
              const fundingRate = parseFloat(data.fundingRate || "0");
              rates.push({
                venue: "bybit",
                market,
                funding_rate: fundingRate,
                funding_rate_pct: (fundingRate * 100).toFixed(4) + "%",
                next_funding_time: new Date(parseInt(data.nextFundingTime || "0")).toISOString(),
                time_to_next_minutes: Math.max(0, (parseInt(data.nextFundingTime || "0") - Date.now()) / 60000),
                open_interest: data.openInterest || "N/A",
                mark_price: data.markPrice || "N/A",
                skew_hint: fundingRate > 0 ? "longs pay shorts" : "shorts pay longs",
              });
            }
          }
        } catch {}
      }
    }

    // Find arbitrage opportunities (funding rate differences between venues)
    const arbOpps: any[] = [];
    for (const market of markets) {
      const marketRates = rates.filter(r => r.market === market);
      if (marketRates.length >= 2) {
        marketRates.sort((a, b) => a.funding_rate - b.funding_rate);
        const lowest = marketRates[0];
        const highest = marketRates[marketRates.length - 1];
        const spreadBps = Math.round((highest.funding_rate - lowest.funding_rate) * 10000);
        if (spreadBps > 1) {
          arbOpps.push({
            market,
            long_venue: lowest.venue,
            short_venue: highest.venue,
            spread_bps: spreadBps,
          });
        }
      }
    }

    return {
      output: {
        rates,
        arb_opportunities: arbOpps,
        summary: `Fetched ${rates.length} funding rates across ${venues.length} venues. ${arbOpps.length} arb opportunity(ies).`,
      },
      usage: { total_tokens: 1 },
    };
  },
});

addEntrypoint({ key: "health", description: "Health check", input: z.object({}), async handler() { return { output: { status: "ok", version: "1.0.0" }, usage: { total_tokens: 0 } }; } });
export default app;
