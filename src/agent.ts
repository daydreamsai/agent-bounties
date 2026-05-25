import { z } from "zod";
import { createAgentApp, AgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "0.1.0",
  description: "Fetch current funding rate and open interest for perps markets",
});

addEntrypin}t({
  key: "fetch-funding-data",
  description: "Fetch current funding rate and open interest for perps markets",
  input: z.object({
    venue_ids: z.array(z.string()),
    markets: z.array(z.string()).optional()
  }),
  async handler({ input }) {
    return {
      output: { funding_rate: String(input.funding_rate ?? ""), time_to_next: String(input.time_to_next ?? ""), open_interest: String(input.open_interest ?? ""), skew: String(input.skew ?? "") }
  }
});

export default app;