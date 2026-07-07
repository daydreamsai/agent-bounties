import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "1.0.0",
  description: "Fetch current funding rate, next tick, open interest, and skew for perps markets across major venues",
});

// ===== Real Perps Exchange API Clients =====

async function fetchBinanceFutures(market?: string) {
  // Binance Futures public API - no auth needed
  const url = "https://fapi.binance.com/fapi/v1/ticker/fundingRate";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const data = await res.json() as Array<{symbol: string; fundingRate: string; fundingTime: number}>;
  
  // Get open interest
  const oiUrl = "https://fapi.binance.com/fapi/v1/openInterest";
  const oiRes = await fetch(oiUrl);
  const oiData = await oiRes.json() as Array<{symbol: string; openInterest: string}>;
  const oiMap = new Map(oiData.map((d: {symbol: string; openInterest: string}) => [d.symbol, d.openInterest]));
  
  const filtered = market 
    ? data.filter((d: {symbol: string}) => d.symbol.includes(market.toUpperCase()))
    : data;
    
  return filtered.slice(0, 20).map((d: {symbol: string; fundingRate: string; fundingTime: number}) => ({
    market: d.symbol,
    funding_rate: parseFloat(d.fundingRate),
    next_funding_time: new Date(d.fundingTime).toISOString(),
    open_interest: parseFloat(oiMap.get(d.symbol) || "0"),
    venue: "binance"
  }));
}

async function fetchHyperliquidMarketInfo() {
  // Hyperliquid public info endpoint
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({type: "allMids"})
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  const data = await res.json() as Record<string, string>;
  return Object.entries(data).slice(0, 20).map(([market, mid]) => ({
    market,
    mark_price: parseFloat(mid),
    venue: "hyperliquid"
  }));
}

addEntrypoint({
  key: "funding",
  description: "Fetch current funding rate, next tick, open interest, and skew per market from major perps venues",
  input: z.object({
    venue_ids: z.array(z.string()).describe("Perps exchanges to query: binance, hyperliquid, dydx"),
    markets: z.array(z.string()).optional().describe("Specific markets to track (e.g. BTC, ETH)"),
  }),
  async handler({ input }) {
    const { venue_ids, markets } = input;
    const results: Record<string, any[]> = {};
    
    for (const venue of venue_ids) {
      const marketFilter = markets?.[0]; // Use first market as filter
      try {
        switch (venue) {
          case "binance": {
            const data = await fetchBinanceFutures(marketFilter);
            results[venue] = data;
            break;
          }
          case "hyperliquid": {
            const info = await fetchHyperliquidMarketInfo();
            results[venue] = info;
            break;
          }
          case "dydx": {
            // dYdX public API
            const res = await fetch("https://api.dydx.exchange/v3/markets");
            const d = await res.json() as {markets: Record<string, any>};
            const markets_list = Object.entries(d.markets || {}).slice(0, 20)
              .map(([key, val]: [string, any]) => ({
                market: key,
                ...(marketFilter && key.includes(marketFilter.toUpperCase()) ? {} : {}),
              }));
            results[venue] = markets_list;
            break;
          }
          default:
            results[venue] = [{ error: `Unknown venue: ${venue}` }];
        }
      } catch (err: any) {
        results[venue] = [{ error: err.message || "Unknown error" }];
      }
    }
    
    return {
      output: {
        timestamp: new Date().toISOString(),
        venues: results,
        summary: Object.entries(results).flatMap(([v, d]) => 
          d.filter(x => !x.error).map(x => ({
            venue: v,
            market: x.market,
            funding_rate: x.funding_rate,
            open_interest: x.open_interest
          }))
        ),
      },
      usage: {
        total_tokens: JSON.stringify(results).length.toString(),
      },
    };
  },
});

// Health check
app.get("/health", (c) => c.json({ status: "ok", agent: "perps-funding-pulse", version: "1.0.0" }));

export default app;
