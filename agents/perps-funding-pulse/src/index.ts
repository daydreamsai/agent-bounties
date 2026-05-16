import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { FundingPulseInput } from "./types";
import { getFundingPulse } from "./agent";

const { app, addEntrypoint } = createAgentApp({
  name: "perps-funding-pulse",
  version: "0.1.0",
  description:
    "Track perpetual futures funding rates across GMX V1/V2, dYdX V4, Hyperliquid, Drift, Perpetual Protocol, ApeX, Zeta, Mango, Kwenta, and Synthetix V3. Identify funding rate arbitrage opportunities and monitor extreme funding events with historical analysis.",
});

addEntrypoint({
  key: "funding_pulse",
  description:
    "Get current funding rates, open interest, skew, and arbitrage opportunities across multiple perpetual DEX venues",
  input: FundingPulseInput,
  async handler({ input }) {
    const result = await getFundingPulse(input);
    return {
      output: result,
      usage: { total_tokens: 0 },
    };
  },
});

export default app;
