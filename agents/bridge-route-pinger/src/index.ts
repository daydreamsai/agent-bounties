import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { PingBridgeInput } from "./types";
import { pingBridgeRoutes } from "./agent";

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "0.1.0",
  description:
    "Monitor cross-chain bridge routes, track latency and availability. Supports Stargate, Across, Hop Protocol, Synapse, Connext, Wormhole, LayerZero, CCIP, Hyperlane, and Socket. Provides fee estimates, ETA, success rates, and route failure alerts.",
});

addEntrypoint({
  key: "ping_routes",
  description:
    "Ping available bridge routes and get live fee/time quotes for cross-chain token transfers",
  input: PingBridgeInput,
  async handler({ input }) {
    const result = await pingBridgeRoutes(input);
    return {
      output: result,
      usage: { total_tokens: 0 },
    };
  },
});

export default app;
