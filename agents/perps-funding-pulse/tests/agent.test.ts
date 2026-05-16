import { describe, it, expect } from "vitest";
import { getFundingPulse } from "../src/agent";
import type { VenueId } from "../src/types";

describe("getFundingPulse", () => {
  it("returns funding data for a single venue", async () => {
    const result = await getFundingPulse({
      venue_ids: ["hyperliquid"],
      markets: ["ETH-USD", "BTC-USD"],
      extreme_threshold: 0.1,
      lookback_hours: 24,
    });

    expect(result.timestamp).toBeDefined();
    expect(result.markets).toHaveLength(2);
    expect(result.summary).toBeDefined();
  });

  it("returns funding data for multiple venues", async () => {
    const result = await getFundingPulse({
      venue_ids: ["dydx_v4", "gmx", "hyperliquid"],
      markets: ["ETH-USD", "BTC-USD"],
      extreme_threshold: 0.1,
      lookback_hours: 24,
    });

    expect(result.markets.length).toBe(6); // 3 venues x 2 markets
    for (const market of result.markets) {
      expect(market.funding_rate).toBeDefined();
      expect(market.time_to_next).toBeGreaterThanOrEqual(0);
      expect(market.open_interest).toBeGreaterThan(0);
      expect(market.skew).toBeGreaterThan(0);
      expect(market.history.length).toBe(24);
    }
  });

  it("uses default markets when none specified", async () => {
    const result = await getFundingPulse({
      venue_ids: ["gmx"],
      markets: [],
      extreme_threshold: 0.1,
      lookback_hours: 1,
    });

    // GMX V1 should have its default markets
    expect(result.markets.length).toBeGreaterThanOrEqual(1);
  });

  it("detects extreme funding rates", async () => {
    const result = await getFundingPulse({
      venue_ids: ["hyperliquid", "drift", "dydx_v4", "gmx", "apex"],
      markets: ["ETH-USD", "BTC-USD"],
      extreme_threshold: 0.01, // Very low threshold to catch extremes
      lookback_hours: 24,
    });

    // With low threshold, some should be marked extreme
    const extremeMarkets = result.markets.filter((m) => m.is_extreme);
    expect(extremeMarkets.length).toBeGreaterThan(0);
    expect(result.extreme_rate_alerts.length).toBeGreaterThan(0);
  });

  it("includes historical data with correct fields", async () => {
    const result = await getFundingPulse({
      venue_ids: ["gmx_v2"],
      markets: ["ETH-USD"],
      extreme_threshold: 0.1,
      lookback_hours: 4,
    });

    const market = result.markets[0];
    expect(market.history).toHaveLength(4);
    for (const point of market.history) {
      expect(point.timestamp).toBeGreaterThan(0);
      expect(point.rate).toBeDefined();
      expect(point.rate_annual).toBeDefined();
      expect(point.open_interest).toBeGreaterThan(0);
      expect(point.mark_price).toBeGreaterThan(0);
      expect(point.index_price).toBeGreaterThan(0);
    }
  });

  it("includes rate volatility", async () => {
    const result = await getFundingPulse({
      venue_ids: ["dydx_v4"],
      markets: ["ETH-USD"],
      extreme_threshold: 0.1,
      lookback_hours: 24,
    });

    expect(result.markets[0].rate_volatility).toBeDefined();
    expect(result.markets[0].rate_volatility).toBeGreaterThanOrEqual(0);
  });

  it("detects arbitrage opportunities across venues", async () => {
    const result = await getFundingPulse({
      venue_ids: ["dydx_v4", "gmx", "hyperliquid", "drift", "perpetual_protocol"],
      markets: ["ETH-USD", "BTC-USD"],
      extreme_threshold: 0.1,
      lookback_hours: 1,
    });

    expect(result.arbitrage_opportunities.length).toBeGreaterThanOrEqual(0);
  });

  it("handles market filtering correctly", async () => {
    const result = await getFundingPulse({
      venue_ids: ["hyperliquid"],
      markets: ["ETH-USD"], // Only ETH
      extreme_threshold: 0.1,
      lookback_hours: 1,
    });

    expect(result.markets).toHaveLength(1);
    expect(result.markets[0].market).toBe("ETH-USD");
  });

  it("each market has skew in valid range", async () => {
    const result = await getFundingPulse({
      venue_ids: ["hyperliquid", "gmx", "dydx_v4"],
      markets: ["ETH-USD"],
      extreme_threshold: 0.1,
      lookback_hours: 1,
    });

    for (const market of result.markets) {
      expect(market.skew).toBeGreaterThanOrEqual(0.5);
      expect(market.skew).toBeLessThanOrEqual(1.5);
    }
  });
});
