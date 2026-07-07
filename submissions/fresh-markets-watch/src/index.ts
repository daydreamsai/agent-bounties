import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { monitorNewPairs } from "./monitor";

const { app, addEntrypoint } = createAgentApp({
  name: "fresh-markets-watch",
  version: "0.1.0",
  description: "List new AMM pairs or pools in the last few minutes",
});

addEntrypoint({
  key: "discover_pairs",
  description: "Discover new AMM pairs created in the last N minutes",
  input: z.object({
    chain: z.string().describe("Target blockchain (e.g., ethereum, polygon, arbitrum)"),
    factories: z.array(z.string()).describe("AMM factory contract addresses to monitor"),
    window_minutes: z.number().min(1).max(60).default(5).describe("Time window in minutes to scan"),
  }),
  async handler({ input }) {
    const results = await monitorNewPairs(input.chain, input.factories, input.window_minutes);
    return {
      output: { pairs: results },
      usage: { total_tokens: JSON.stringify(results).length },
    };
  },
});

export default app;