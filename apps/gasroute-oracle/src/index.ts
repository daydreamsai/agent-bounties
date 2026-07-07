import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "gasroute-oracle",
  version: "0.1.0",
  description: "Choose cheapest chain and timing for transactions",
});

addEntrypoint({
  key: "getGasRoute",
  description: "Get the best chain and timing for a given gas load",
  input: z.object({
    chain_set: z.array(z.string()),
    calldata_size_bytes: z.number(),
    gas_units_est: z.number(),
  }),
  output: z.object({
    chain: z.string(),
    fee_native: z.number(),
    fee_usd: z.number(),
    busy_level: z.number(),
    tip_hint: z.number(),
  }),
  async handler({ input }) {
    // Mock implementation - in a real scenario, this would connect to a gas oracle
    // and return the actual data based on current network conditions
    return {
      output: {
        chain: "ethereum",
        fee_native: 0.001,
        fee_usd: 0.5,
        busy_level: 1,
        tip_hint: 1.5,
      },
      usage: { total_tokens: 100 },
    };
  },
});

export default app;