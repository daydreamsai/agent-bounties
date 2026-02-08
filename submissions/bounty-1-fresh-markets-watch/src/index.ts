import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { scanNewPairs } from "./pair-scanner.js";

const { app, addEntrypoint } = createAgentApp({
  name: "fresh-markets-watch",
  version: "1.0.0",
  description: "List new AMM pairs or pools created in the last N minutes",
});

addEntrypoint({
  key: "scan",
  description: "List new AMM pairs or pools in the last N minutes",
  input: z.object({
    chain: z.string().optional().default("base").describe("Target blockchain"),
    factories: z.array(z.string()).optional().describe("AMM factory contracts to monitor"),
    window_minutes: z.number().optional().default(60).describe("Time window to scan"),
  }),
  output: z.object({
    chain: z.string(),
    window_minutes: z.number(),
    pairs_found: z.number(),
    pairs: z.array(z.object({
      pair_address: z.string(),
      tokens: z.array(z.string()),
      factory: z.string(),
      factory_name: z.string(),
      created_at: z.string(),
      block_number: z.number(),
    })),
    summary: z.string(),
  }),
  async handler({ input }) {
    const chain = input.chain ?? "base";
    const windowMinutes = input.window_minutes ?? 60;
    const pairs = await scanNewPairs(chain, windowMinutes, input.factories);

    return {
      output: {
        chain,
        window_minutes: windowMinutes,
        pairs_found: pairs.length,
        pairs,
        summary: `Found ${pairs.length} new pair(s) on ${chain} in the last ${windowMinutes} minutes.`,
      },
      usage: { total_tokens: pairs.length },
    };
  },
});

addEntrypoint({
  key: "health",
  description: "Health check",
  input: z.object({}),
  async handler() {
    return {
      output: { status: "ok", supported_chains: ["base"], version: "1.0.0" },
      usage: { total_tokens: 0 },
    };
  },
});

export default app;
