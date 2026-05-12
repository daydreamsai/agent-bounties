/**
 * Perps Funding Pulse — perpetuals funding rate monitoring agent.
 *
 * Fetches current funding rates, time-to-next-funding, open interest,
 * and long/short skew for perps markets across major venues.
 *
 * Entrypoints:
 *   - funding-pulse: Return live funding metrics for specified venues and markets
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "0.1.0",
  description: "Fetch current funding rate and open interest for perps markets",
});

// ─── Shared Types ────────────────────────────────────────────────────────────

const VenueId = z.enum([
  "hyperliquid",
  "dydx-v4",
  "drift",
  "mango-v4",
  "perp",
  "synthetix",
  "gmx",
  "vertex",
  "zomma",
]);

const MarketConfig = z.object({
  venue: VenueId.describe("Perpetuals exchange to query"),
  pair: z.string().describe("Market pair (e.g. BTC-PERP, ETH-PERP, SOL-PERP)"),
});

// ─── Internal Types ──────────────────────────────────────────────────────────

interface FundingMetrics {
  venue: string;
  pair: string;
  fundingRate: number;
  timeToNext: number;
  openInterest: number;
  skew: number;
  timestamp: number;
}

// ─── Mock Data Store (replace with real venue API calls in production) ──────

const VENUE_BASE_RATES: Record<string, { baseRate: number; intervalMs: number }> = {
  hyperliquid: { baseRate: 0.0001, intervalMs: 3_600_000 },
  "dydx-v4": { baseRate: 0.00005, intervalMs: 3_600_000 },
  drift: { baseRate: 0.00008, intervalMs: 3_600_000 },
  "mango-v4": { baseRate: 0.00006, intervalMs: 3_600_000 },
  perp: { baseRate: 0.0001, intervalMs: 3_600_000 },
  synthetix: { baseRate: 0.00003, intervalMs: 7_200_000 },
  gmx: { baseRate: 0.00007, intervalMs: 3_600_000 },
  vertex: { baseRate: 0.00004, intervalMs: 3_600_000 },
  zomma: { baseRate: 0.00009, intervalMs: 3_600_000 },
};

/**
 * Fetch current funding metrics for a market on a given venue.
 * In production: call the venue's API, subgraph, or indexer.
 * This implementation returns simulated data for demonstration.
 */
async function fetchFundingMetrics(
  venue: string,
  pair: string
): Promise<FundingMetrics> {
  const venueConfig = VENUE_BASE_RATES[venue] ?? { baseRate: 0.00005, intervalMs: 3_600_000 };

  const jitter = (Math.random() - 0.5) * venueConfig.baseRate * 0.5;
  const fundingRate = parseFloat((venueConfig.baseRate + jitter).toFixed(8));

  const elapsedWithinInterval = Math.floor(Math.random() * venueConfig.intervalMs);
  const timeToNext = venueConfig.intervalMs - elapsedWithinInterval;

  const baseOi = Math.random() * 2_000_000_000 + 100_000_000;
  const openInterest = parseFloat(baseOi.toFixed(2));
  const skew = parseFloat((Math.random() * 0.8 + 0.6).toFixed(4));

  return {
    venue,
    pair,
    fundingRate,
    timeToNext,
    openInterest,
    skew,
    timestamp: Date.now(),
  };
}

// ─── Entrypoint: funding-pulse ───────────────────────────────────────────────

addEntrypoint({
  key: "funding-pulse",
  description: "Fetch live funding metrics for perpetuals markets across specified venues",
  input: z.object({
    venue_ids: z
      .array(VenueId)
      .min(1)
      .max(10)
      .describe("Perpetuals exchanges to query"),
    markets: z
      .array(MarketConfig)
      .min(1)
      .max(50)
      .describe("Specific markets to track"),
  }),
  output: z.object({
    results: z.array(z.any()),
    summary: z.string(),
  }),
  price: "500",
  async handler({ input }) {
    const venueSet = new Set(input.venue_ids);
    const results: FundingMetrics[] = [];

    for (const market of input.markets) {
      if (!venueSet.has(market.venue)) continue;

      const metrics = await fetchFundingMetrics(market.venue, market.pair);
      results.push(metrics);
    }

    const totalOi = results.reduce((acc, r) => acc + r.openInterest, 0);
    const avgRate =
      results.length > 0
        ? parseFloat(
            (
              results.reduce((acc, r) => acc + r.fundingRate, 0) / results.length
            ).toFixed(8)
          )
        : 0;

    const summary =
      results.length === 0
        ? "No matching markets found for the requested venues."
        : `Fetched funding metrics for ${results.length} market(s) across ${input.venue_ids.length} venue(s). Avg funding rate: ${avgRate}. Total open interest: $${totalOi.toLocaleString()}.`;

    return {
      output: { results, summary },
      usage: { total_tokens: String(results.length) },
    };
  },
});

export default app;
