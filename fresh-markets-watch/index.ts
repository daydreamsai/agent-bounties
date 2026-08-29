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
    const nowSec = Math.floor(Date.now() / 1000);
    const cutoff = nowSec - input.window_minutes * 60;

    // Placeholder: real implementation would query an indexer or RPC logs
    // for PairCreated events from each factory since `cutoff`.
    const newPairs: Array<{
      pair_address: string;
      tokens: string[];
      init_liquidity: string;
      top_holders: string[];
      created_at: number;
    }> = [];

    return {
      output: {
        chain: input.chain,
        factories: input.factories,
        window_minutes: input.window_minutes,
        pairs: newPairs,
        scanned_at: nowSec,
      },
      usage: {
        total_tokens: String(
          JSON.stringify(input).length + JSON.stringify(newPairs).length
        ),
      },
    };
  },
});

export default app;
