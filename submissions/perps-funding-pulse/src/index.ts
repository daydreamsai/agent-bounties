import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { fetchFundingData } from "./logic.js";

// ---------------------------------------------------------------------------
// Agent bootstrap
// ---------------------------------------------------------------------------

if (!process.env.ADDRESS) {
  throw new Error(
    "ADDRESS environment variable is required. Refusing to start with the zero address to prevent burning payments."
  );
}

const { app, addEntrypoint } = createAgentApp(
  {
    name: "perps-funding-pulse",
    version: "1.0.0",
    description:
      "Fetch current funding rate, next tick, and open interest per market from perpetuals exchanges",
  },
  {
    payments: {
      payTo: process.env.ADDRESS as `0x${string}`,
      network: (process.env.NETWORK as any) || "base-sepolia",
      defaultPrice: process.env.DEFAULT_PRICE || "1000",
    } as any,
  }
);

// ---------------------------------------------------------------------------
// Entrypoint: analyze
// ---------------------------------------------------------------------------

addEntrypoint({
  key: "analyze",
  description:
    "Fetch funding rates, open interest, time to next tick, and long/short skew for perpetual futures markets",
  input: z.object({
    venue_ids: z
      .array(z.string())
      .optional()
      .default(["hyperliquid"])
      .describe("Perpetuals exchanges to query (e.g. hyperliquid)"),
    markets: z
      .array(z.string())
      .optional()
      .default(["BTC", "ETH"])
      .describe(
        "Specific markets to track (e.g. BTC, ETH, SOL). Leave empty for all."
      ),
  }) as any,
  output: z.object({
    markets: z.array(
      z.object({
        venue: z.string(),
        market: z.string(),
        funding_rate: z.number(),
        funding_rate_annualized: z.number(),
        time_to_next: z.string(),
        time_to_next_seconds: z.number(),
        open_interest: z.number(),
        open_interest_notional: z.string(),
        skew: z.number(),
        skew_direction: z.string(),
        mark_price: z.string(),
        oracle_price: z.string(),
        day_volume: z.string(),
        premium: z.string(),
      })
    ),
    venue_count: z.number(),
    timestamp: z.string(),
    summary: z.string(),
  }) as any,
  async handler({ input }: any) {
    const venueIds: string[] = input.venue_ids ?? ["hyperliquid"];
    const markets: string[] = input.markets ?? ["BTC", "ETH"];

    const result = await fetchFundingData(venueIds, markets);

    return {
      output: result,
      usage: { total_tokens: result.markets.length },
    };
  },
} as any);

// ---------------------------------------------------------------------------
// Entrypoint: health
// ---------------------------------------------------------------------------

addEntrypoint({
  key: "health",
  description: "Health check and supported venue listing",
  input: z.object({}) as any,
  output: z.object({
    status: z.string(),
    version: z.string(),
    supported_venues: z.array(z.string()),
    default_markets: z.array(z.string()),
  }) as any,
  async handler() {
    return {
      output: {
        status: "ok",
        version: "1.0.0",
        supported_venues: ["hyperliquid"],
        default_markets: ["BTC", "ETH"],
      },
      usage: { total_tokens: 0 },
    };
  },
} as any);

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default app;
