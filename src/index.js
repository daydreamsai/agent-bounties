import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import axios from "axios";

// Create the agent app
const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "0.1.0",
  description: "Fetch current funding rate, next tick, and open interest for perpetuals markets",
});

// Helper function to fetch data from Binance Futures
async function fetchBinanceData(symbol) {
  try {
    // Premium index provides funding rate and next funding time
    const premiumRes = await axios.get(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`);
    const premiumData = premiumRes.data;
    
    // Open interest
    const oiRes = await axios.get(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`);
    const oiData = oiRes.data;

    // Top long/short account ratio (proxy for skew)
    const ratioRes = await axios.get(`https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`);
    const ratioData = ratioRes.data;

    return {
      funding_rate: parseFloat(premiumData.lastFundingRate),
      time_to_next: Math.max(0, parseInt(premiumData.nextFundingTime) - Date.now()), // in milliseconds
      open_interest: parseFloat(oiData.openInterest),
      skew: ratioData.length > 0 ? parseFloat(ratioData[0].longShortRatio) : 1.0,
    };
  } catch (error) {
    throw new Error(`Failed to fetch data from Binance for ${symbol}: ${error.message}`);
  }
}

// Add the main entrypoint
addEntrypoint({
  key: "fetch_funding",
  description: "Fetch live funding metrics for perps markets",
  input: z.object({
    venue_ids: z.array(z.string()).describe("Perpetuals exchanges to query (e.g., ['binance'])"),
    markets: z.array(z.string()).describe("Specific markets to track (e.g., ['BTCUSDT', 'ETHUSDT'])"),
  }),
  async handler({ input }) {
    const results = {};
    const venues = input.venue_ids.map(v => v.toLowerCase());
    
    for (const venue of venues) {
      results[venue] = {};
      
      if (venue === 'binance') {
        for (const market of input.markets) {
          try {
            results[venue][market] = await fetchBinanceData(market);
          } catch (e) {
            results[venue][market] = { error: e.message };
          }
        }
      } else {
         results[venue] = { error: "Venue not supported by this agent yet. Supported venues: ['binance']" };
      }
    }

    return {
      output: results,
      usage: { total_tokens: 100 }, // Mock token usage
    };
  },
});

export default app;
