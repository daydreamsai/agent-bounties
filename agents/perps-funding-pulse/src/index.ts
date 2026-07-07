import { z } from "zod";
import { createAgentApp, createHandler } from "@lucid-dreams/agent-kit";
import { AgentApp } from "@lucid-dreams/agent-kit";
const { addEntrypoint } = createHandler({
  name: "perps-funding-pulse",
  version: "0.1.0",
  description: "Fetch current funding rate and open interest for perps markets",
});
addEntrypoint({
  key: "perps-funding-pulse",
  description: "Perps funding data fetcher",
  input: z.object({ 
    venue_ids: z.array(z.string()).optional(),
    markets: z.array(z.string()).optional()
  }),
  async handler({ input }) {
    const { venue_ids, markets } = input;
    // Implementation would go here to fetch funding rates, open interest, etc.
    return {
      output: {
        venue_ids: venue_ids ?? [],
        markets: markets ?? []
      }
    };
  }
}));
export default createAgentApp({
  name: "perps-funding-pulse",
  version: "0.1.0",
  description: "Fetch current funding rate and open interest for perps markets",
});
export { addEntrypoint } from "./src/index";