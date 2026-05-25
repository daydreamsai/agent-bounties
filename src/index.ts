import { z } from "zod";
import { createAgentApp, addEntrypoint } from "@daydreamsai/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "0.1.0",
  description: "Fetch current funding rate and open interest for perps markets",
});

export default app;

addEntrypoint({
  name: "echo",
  description: "Echo a message",
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "") },
      usage: { total_tokens: String(input.text ?? "").length },
    };
  },
});

addEntrypoint({
  name: "fetchPerpsFunding",
  description: "Fetch current funding rate, next tick, and open interest per market",
  input: z.object({
    venue_ids: z.array(z.string()).optional(),
    markets: z.array(z.string()).optional(),
  }),
  async handler({ input }) {
    const venueIds = input.venue_ids ?? ["hyperliquid", "dydx", "gmx"];
    const markets = input.markets ?? ["BTC-PERP", "ETH-PERP", "SOL-PERP"];

    const results = await Promise.all(
      venueIds.map(async (venue) => {
        const venueData = await fetch(`https://api.${venue}.com/funding-rates?markets=${markets.join(",")}`)
          .then((res) => res.json())
          .catch(() => ({ error: `Failed to fetch from ${venue}` }));

        return {
          venue,
          markets: venueData.rates?.map((rate: any) => ({
            market: rate.market,
            funding_rate: rate.fundingRate,
            time_to_next: rate.nextFundingTime,
            open_interest: rate.openInterest,
            skew: rate.longShortRatio,
          })) ?? [],
        };
      })
    );

    return {
      output: { venues: results },
      usage: { total_tokens: JSON.stringify(results).length },
    };
  },
});