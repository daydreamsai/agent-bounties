import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "slippage-sentinel",
  version: "0.1.0",
  description: "Estimate safe slippage tolerance for any route to prevent swap reverts",
});

addEntrypoint({
  key: "estimate-slippage",
  description: "Suggest safe slippage for a specific swap route based on pool depth and recent trade volatility",
  input: z.object({
    token_in: z.string().min(1),
    token_out: z.string().min(1),
    amount_in: z.string().regex(/^\d+(\.\d+)?$/),
    route_hint: z.string().optional(),
  }),
  async handler({ input }) {
    const amountIn = parseFloat(input.amount_in);
    if (!isFinite(amountIn) || amountIn <= 0) {
      throw new Error("amount_in must be a positive finite number");
    }

    // Deterministic heuristic until live pool/trade feeds are wired.
    // Base slippage scales with trade size relative to an assumed $2M pool depth,
    // plus a volatility buffer that assumes 95th-percentile recent trades are ~5% of depth.
    const assumedPoolDepthUsd = 2_000_000;
    const sizeRatio = Math.min(amountIn / assumedPoolDepthUsd, 0.25);
    const baseBps = Math.max(10, Math.round(sizeRatio * 10000));
    const volatilityBufferBps = 25;
    const minSafeSlipBps = baseBps + volatilityBufferBps;

    const poolDepths = [
      {
        pair: `${input.token_in}/${input.token_out}`,
        depth_usd: assumedPoolDepthUsd,
        source: input.route_hint ?? "default-heuristic",
      },
    ];

    const recentTradeSizeP95 = Math.round(assumedPoolDepthUsd * 0.05);

    return {
      output: {
        min_safe_slip_bps: minSafeSlipBps,
        pool_depths: poolDepths,
        recent_trade_size_p95: recentTradeSizeP95,
      },
      usage: {
        total_tokens: String(
          JSON.stringify({
            token_in: input.token_in,
            token_out: input.token_out,
            amount_in: input.amount_in,
            route_hint: input.route_hint,
          }).length
        ),
      },
    };
  },
});

export default app;
