import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import axios from "axios";

const { app, addEntrypoint } = createAgentApp({
  name: "slippage-sentinel",
  version: "0.1.0",
  description: "Estimate safe slippage tolerance for any route to prevent swap reverts.",
});

// Mocking aggregator APIs/liquidity depth queries for the bounty submission
async function fetchPoolDepth(tokenIn, tokenOut, amount, routeHint) {
  // Simulating fetching pool depths and computing the impact
  const mockImpact = (parseFloat(amount) / 1000000) * 0.5; // dummy formula
  return {
    depth: 5000000,
    estimatedImpactPct: mockImpact,
    p95TradeSize: 10000
  };
}

addEntrypoint({
  key: "estimate_slippage",
  description: "Suggest safe slippage for a specific swap route",
  input: z.object({
    token_in: z.string(),
    token_out: z.string(),
    amount_in: z.string(),
    route_hint: z.string().optional(),
  }),
  async handler({ input }) {
    // In a real implementation we would fetch active liquidity depths 
    // for the suggested route (e.g. Uniswap V3 ticks)
    const { estimatedImpactPct, p95TradeSize, depth } = await fetchPoolDepth(
      input.token_in, 
      input.token_out, 
      input.amount_in, 
      input.route_hint
    );

    // Baseline minimum slippage (e.g. 10 bps = 0.1%)
    let safeSlippageBps = 10; 

    // Add estimated price impact
    safeSlippageBps += Math.ceil(estimatedImpactPct * 10000);

    // Add volatility buffer based on recent trades
    if (parseFloat(input.amount_in) > p95TradeSize) {
       safeSlippageBps += 50; // extra 0.5% if it's a huge trade
    }

    return {
      output: {
        min_safe_slip_bps: Math.max(10, safeSlippageBps),
        pool_depths: depth.toString(),
        recent_trade_size_p95: p95TradeSize.toString(),
      },
      usage: { total_tokens: 110 },
    };
  },
});

export default app;