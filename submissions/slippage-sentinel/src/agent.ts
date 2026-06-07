import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { estimateSlippage } from "./core.js";

const { app, addEntrypoint } = createAgentApp({
  name: "slippage-sentinel",
  version: "0.1.0",
  description: "Estimate safe slippage tolerance for a token swap route"
});

addEntrypoint({
  key: "estimate_slippage",
  description: "Return minimum safe slippage, route pool depths, and recent p95 trade size.",
  input: z.object({
    token_in: z.string().min(1),
    token_out: z.string().min(1),
    amount_in: z.union([z.string(), z.number()]),
    amount_usd: z.number().positive().optional(),
    route_hint: z.string().optional()
  }),
  async handler({ input }) {
    const output = await estimateSlippage(input);
    return {
      output,
      usage: {
        total_tokens: String(JSON.stringify(output).length)
      }
    };
  }
});

export default app;

