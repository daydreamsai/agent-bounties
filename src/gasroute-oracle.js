import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import axios from "axios";

const { app, addEntrypoint } = createAgentApp({
  name: "gasroute-oracle",
  version: "0.1.0",
  description: "Choose cheapest chain and timing for transactions",
});

// Mock pricing functions for the bounty submission
// In production, we'd hit GasTracker APIs or public RPCs (eth_gasPrice) for each chain
async function estimateGas(chain, gasUnits) {
  const mockGasPrices = {
    ethereum: { priceGwei: 15, nativeUsd: 3000 },
    arbitrum: { priceGwei: 0.1, nativeUsd: 3000 },
    optimism: { priceGwei: 0.05, nativeUsd: 3000 },
    base:     { priceGwei: 0.01, nativeUsd: 3000 },
    polygon:  { priceGwei: 50, nativeUsd: 1.0 },
    bsc:      { priceGwei: 3, nativeUsd: 400 },
  };
  
  const data = mockGasPrices[chain.toLowerCase()] || mockGasPrices['ethereum'];
  
  const feeNative = (gasUnits * (data.priceGwei * 1e9)) / 1e18; // converting gwei to native token
  const feeUsd = feeNative * data.nativeUsd;

  return { feeNative, feeUsd, busyLevel: "low", tipHint: (data.priceGwei * 0.1).toFixed(2) };
}

addEntrypoint({
  key: "estimate_route",
  description: "Return best chain and time estimate for given gas load",
  input: z.object({
    chain_set: z.array(z.string()),
    calldata_size_bytes: z.number(),
    gas_units_est: z.number(),
  }),
  async handler({ input }) {
    // Basic L1 calldata cost approximation: 16 gas per non-zero byte (assuming all non-zero for worst case)
    const calldataGas = input.calldata_size_bytes * 16;
    const totalGas = input.gas_units_est + calldataGas;

    let bestChain = null;
    let minFeeUsd = Infinity;
    let bestFeeNative = 0;
    let bestBusyLevel = "low";
    let bestTipHint = "0";

    for (const chain of input.chain_set) {
      try {
        const { feeNative, feeUsd, busyLevel, tipHint } = await estimateGas(chain, totalGas);
        if (feeUsd < minFeeUsd) {
          minFeeUsd = feeUsd;
          bestChain = chain;
          bestFeeNative = feeNative;
          bestBusyLevel = busyLevel;
          bestTipHint = tipHint;
        }
      } catch (e) {
        console.error(`Failed gas estimation for ${chain}`, e);
      }
    }

    return {
      output: {
        chain: bestChain,
        fee_native: bestFeeNative.toString(),
        fee_usd: minFeeUsd.toString(),
        busy_level: bestBusyLevel,
        tip_hint: bestTipHint,
      },
      usage: { total_tokens: 130 },
    };
  },
});

export default app;