import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "gasroute-oracle",
  version: "0.1.0",
  description: "Choose cheapest chain and timing for transactions",
});

const Chain = z.enum(["ethereum", "polygon", "optimism", "arbitrum", "avalanche"]);
const ChainSet = z.array(Chain);

addEntrypoint({
  key: "getBestChain",
  description: "Return best chain and time estimate for given gas load",
  input: z.object({
    chain_set: ChainSet,
    calldata_size_bytes: z.number(),
    gas_units_est: z.number(),
  }),
  async handler({ input }) {
    // Mock function to simulate fetching gas data
    const fetchGasData = async (chain: string) => {
      // Simulated data
      return {
        fee_native: Math.random() * 100,
        fee_usd: Math.random() * 10,
        busy_level: Math.random(),
        tip_hint: Math.random() * 10,
      };
    };

    let bestChain = null;
    let bestFee = Infinity;

    for (const chain of input.chain_set) {
      const gasData = await fetchGasData(chain);
      if (gasData.fee_native < bestFee) {
        bestFee = gasData.fee_native;
        bestChain = {
          chain,
          fee_native: gasData.fee_native,
          fee_usd: gasData.fee_usd,
          busy_level: gasData.busy_level,
          tip_hint: gasData.tip_hint,
        };
      }
    }

    return {
      output: bestChain,
      usage: { total_tokens: 0 },
    };
  },
});

export default app;