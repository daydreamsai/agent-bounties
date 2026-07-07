import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { discoverPairs } from "./discover";

const { app, addEntrypoint } = createAgentApp({
  name: "fresh-markets-watch",
  version: "0.1.0",
  description: "List new AMM pairs or pools in the last few minutes",
});

addEntrypoint({
  key: "discover",
  description: "Discover new AMM pairs or pools in the last N minutes",
  input: z.object({
    chain: z.string(),
    factories: z.array(z.string()),
    window_minutes: z.number().min(1).max(60),
  }),
  async handler({ input }) {
    const pairs = await discoverPairs(input.chain, input.factories, input.window_minutes);
    return {
      output: { pairs },
      usage: { total_tokens: JSON.stringify(pairs).length },
    };
  },
});

export default app;