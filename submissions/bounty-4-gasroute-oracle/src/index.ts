import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { createPublicClient, http, formatGwei } from "viem";
import { mainnet, base, arbitrum, optimism } from "viem/chains";

const CHAINS: Record<string, { chain: any; rpc: string; name: string }> = {
  ethereum: { chain: mainnet, rpc: "https://1rpc.io/eth", name: "Ethereum" },
  base: { chain: base, rpc: "https://1rpc.io/base", name: "Base" },
  arbitrum: { chain: arbitrum, rpc: "https://1rpc.io/arb", name: "Arbitrum" },
  optimism: { chain: optimism, rpc: "https://1rpc.io/op", name: "Optimism" },
};

const { app, addEntrypoint } = createAgentApp({
  name: "gasroute-oracle",
  version: "1.0.0",
  description: "Compare gas costs across chains and recommend the cheapest execution route",
});

addEntrypoint({
  key: "compare",
  description: "Compare gas costs across chains for a given transaction",
  input: z.object({
    chain_set: z.array(z.string()).optional().default(["ethereum", "base", "arbitrum", "optimism"]),
    calldata_size_bytes: z.number().optional().default(100),
    gas_units_est: z.number().optional().default(200000),
  }),
  output: z.object({
    recommendations: z.array(z.object({
      chain: z.string(),
      fee_native: z.string(),
      fee_usd: z.number(),
      gas_price_gwei: z.number(),
      busy_level: z.enum(["low", "medium", "high", "extreme"]),
      tip_hint: z.string(),
    })),
    best_chain: z.string(),
    summary: z.string(),
  }),
  async handler({ input }) {
    const chainSet = input.chain_set ?? Object.keys(CHAINS);
    const gasUnits = BigInt(input.gas_units_est ?? 200000);
    const results: any[] = [];

    // ETH price approximation
    const ethPrice = 2100;

    for (const chainName of chainSet) {
      const cfg = CHAINS[chainName];
      if (!cfg) continue;
      try {
        const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc) });
        const gasPrice = await client.getGasPrice();
        const feeWei = gasPrice * gasUnits;
        const feeEth = Number(feeWei) / 1e18;
        const feeUsd = feeEth * ethPrice;
        const gasPriceGwei = Number(gasPrice) / 1e9;

        let busyLevel: "low" | "medium" | "high" | "extreme";
        if (gasPriceGwei < 0.01) busyLevel = "low";
        else if (gasPriceGwei < 1) busyLevel = "medium";
        else if (gasPriceGwei < 30) busyLevel = "high";
        else busyLevel = "extreme";

        results.push({
          chain: chainName,
          fee_native: feeEth.toFixed(8) + " ETH",
          fee_usd: Math.round(feeUsd * 10000) / 10000,
          gas_price_gwei: Math.round(gasPriceGwei * 1000) / 1000,
          busy_level: busyLevel,
          tip_hint: busyLevel === "low" ? "No tip needed" : busyLevel === "medium" ? "0.001 gwei tip" : "1+ gwei tip recommended",
        });
      } catch {}
    }

    results.sort((a, b) => a.fee_usd - b.fee_usd);
    const best = results[0]?.chain ?? "unknown";

    return {
      output: {
        recommendations: results,
        best_chain: best,
        summary: `Cheapest: ${best} ($${results[0]?.fee_usd ?? "?"}). Scanned ${results.length} chains.`,
      },
      usage: { total_tokens: 1 },
    };
  },
});

addEntrypoint({ key: "health", description: "Health check", input: z.object({}), async handler() { return { output: { status: "ok", version: "1.0.0" }, usage: { total_tokens: 0 } }; } });
export default app;
