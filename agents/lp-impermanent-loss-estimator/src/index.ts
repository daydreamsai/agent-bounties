import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { EstimateILInput } from "./types";
import { estimateImpermanentLoss } from "./agent";

const { app, addEntrypoint } = createAgentApp({
  name: "lp-impermanent-loss-estimator",
  version: "0.1.0",
  description:
    "Calculate impermanent loss and fee APR for any LP position on Uniswap V2, V3, Curve, and Balancer pools. Includes price ratio analysis, break-even calculations, and token-level PnL breakdown.",
});

addEntrypoint({
  key: "estimate_il",
  description:
    "Estimate impermanent loss, fee APR, and break-even price ratio for an LP position",
  input: EstimateILInput,
  async handler({ input }) {
    const result = await estimateImpermanentLoss(input);
    return {
      output: result,
      usage: { total_tokens: 0 },
    };
  },
});

export default app;
