import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";

const { app, addEntrypoint } = createAgentApp({
  name: "lp-il-estimator",
  version: "1.0.0",
  description: "Estimate impermanent loss for LP positions based on price movements",
});

function calculateIL(priceRatio: number): number {
  // IL formula: IL = 2*sqrt(r)/(1+r) - 1 where r = new_price/old_price
  const sqrtR = Math.sqrt(priceRatio);
  return (2 * sqrtR) / (1 + priceRatio) - 1;
}

addEntrypoint({
  key: "estimate",
  description: "Estimate impermanent loss for a Uniswap V2-style LP position",
  input: z.object({
    pool_address: z.string().optional().describe("Pool address (optional, for on-chain data)"),
    token_weights: z.array(z.number()).optional().default([50, 50]).describe("Token weight distribution"),
    deposit_amounts: z.array(z.string()).optional().describe("Deposit amounts in wei"),
    price_change_pct: z.number().optional().default(10).describe("Simulated price change percentage"),
    window_hours: z.number().optional().default(24).describe("Historical window for volume"),
    chain_id: z.number().optional().default(8453),
  }),
  output: z.object({
    IL_percent: z.number(),
    IL_vs_hold: z.string(),
    fee_apr_est: z.number(),
    volume_window: z.string(),
    price_scenarios: z.array(z.object({
      price_change_pct: z.number(),
      IL_percent: z.number(),
      net_with_fees: z.number(),
    })),
    notes: z.string(),
  }),
  async handler({ input }) {
    const priceChangePct = input.price_change_pct ?? 10;
    const scenarios = [-50, -30, -20, -10, -5, 0, 5, 10, 20, 30, 50, 100];
    
    const priceScenarios = scenarios.map(pct => {
      const ratio = 1 + pct / 100;
      const il = calculateIL(ratio);
      return {
        price_change_pct: pct,
        IL_percent: Math.round(il * 10000) / 100,
        net_with_fees: Math.round((il + 0.003) * 10000) / 100, // Assume 0.3% daily fees
      };
    });

    const mainRatio = 1 + priceChangePct / 100;
    const mainIL = calculateIL(mainRatio);

    // Estimate fee APR (need pool data for accurate calc)
    let feeAprEst = 0;
    let volumeWindow = "N/A";
    
    if (input.pool_address) {
      try {
        const client = createPublicClient({ chain: base, transport: http("https://1rpc.io/base") });
        // Try to get pool reserves for volume estimation
        const PAIR_ABI = [{
          name: "getReserves",
          type: "function",
          stateMutability: "view",
          inputs: [],
          outputs: [
            { name: "reserve0", type: "uint112" },
            { name: "reserve1", type: "uint112" },
            { name: "blockTimestampLast", type: "uint32" },
          ],
        }] as const;

        const reserves = await client.readContract({
          address: input.pool_address as Address,
          abi: PAIR_ABI,
          functionName: "getReserves",
        });
        
        const tvl = Number(reserves[0]) / 1e18 * 2 * 2100; // Rough USD TVL
        feeAprEst = tvl > 0 ? Math.round((tvl * 0.003 * 365 / tvl) * 100) / 100 : 0;
        volumeWindow = `~$${Math.round(tvl * 0.1).toLocaleString()} (estimated)`;
      } catch {
        feeAprEst = 10; // Default estimate
        volumeWindow = "Unable to fetch on-chain data";
      }
    }

    return {
      output: {
        IL_percent: Math.round(mainIL * 10000) / 100,
        IL_vs_hold: `${Math.round(mainIL * 10000) / 100}% loss vs holding`,
        fee_apr_est: feeAprEst,
        volume_window: volumeWindow,
        price_scenarios: priceScenarios,
        notes: `For a ${priceChangePct}% price change, IL is ${(mainIL * 100).toFixed(2)}%. ` +
          `This means LPing returns ${(mainIL * 100).toFixed(2)}% less than simply holding. ` +
          `Fees may offset this depending on pool volume.`,
      },
      usage: { total_tokens: 1 },
    };
  },
});

addEntrypoint({ key: "health", description: "Health check", input: z.object({}), async handler() { return { output: { status: "ok", version: "1.0.0" }, usage: { total_tokens: 0 } }; } });
export default app;
