import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { estimateGasRoute } from "./core.js";

const { app, addEntrypoint } = createAgentApp({
  name: "gasroute-oracle",
  version: "0.1.0",
  description: "Choose the cheapest EVM chain and timing hint for a swap or contract call"
});

addEntrypoint({
  key: "estimate_gas_route",
  description: "Return the cheapest chain, native fee, USD fee, congestion level, and priority-fee hint.",
  input: z.object({
    chain_set: z.array(z.string()).min(1),
    calldata_size_bytes: z.number().int().nonnegative(),
    gas_units_est: z.number().int().positive()
  }),
  async handler({ input }) {
    const output = await estimateGasRoute(input);
    return {
      output,
      usage: {
        total_tokens: String(JSON.stringify(output).length)
      }
    };
  }
});

export default app;

