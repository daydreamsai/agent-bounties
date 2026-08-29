import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "fresh-markets-watch",
  version: "0.1.0",
  description: "List new AMM pairs or pools in the last few minutes",
});

addEntrypoint({
  key: "watch",
  description: "List new AMM pairs or pools created within a time window",
  input: z.object({
    chain: z.string().min(1),
    factories: z.array(z.string()).min(1),
    window_minutes: z.number().int().positive(),
  }),
  async handler({ input }) {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - input.window_minutes * 60;

    // Placeholder: In production, replace with real indexer/RPC logic
    // that queries PairCreated events from each factory since `cutoff`.
    const pairs: Array<{
      pair_address: string;
      tokens: [string, string];
      init_liquidity: string;
      top_holders: string[];
      created_at: number;
    }> = [];

    return {
      output: {
        chain: input.chain,
        window_minutes: input.window_minutes,
        scanned_factories: input.factories,
        pairs,
        scanned_from: cutoff,
        scanned_to: now,
      },
      usage: {
        total_tokens: String(
          JSON.stringify(input).length + JSON.stringify(pairs).length
        ),
      },
    };
  },
});

export default app;
