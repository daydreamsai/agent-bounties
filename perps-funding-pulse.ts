import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "0.1.0",
  description: "Fetch current funding rate and open interest for perps markets",
});

addEntrypoint({
  key: "fetchFundingData",
  description: "Fetch perpetuals funding data including rate, time to next payment, open interest and skew",
  input: z.object({ 
    venue_ids: z.array(z.string()).optional(),
    markets: z.array(z.string()).optional()
  }),
  async handler({ input }) {
    // Simulate fetching data - in a real implementation this would call exchange APIs
    const venueIds = input.venue_ids || [];
    const markets = input.markets || [];
    
    // Return mock data - to be replaced with real API calls
    return {
      output: {
        funding_rate: 0.0001,
        time_to_next: 3600, // 1 hour in seconds
        open_interest: 1000000, // example value
        skew: 0.65 // example long/short ratio
      },
      usage: { 
        total_tokens: "0" 
      }
    };
  }
});

addEntrypoint({
  key: "echo",
  description: "Echo a message",
  input: z.object({ text: z.string() }),