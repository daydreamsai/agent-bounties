import { z } from "zod";
import { createAgentApp, addEntrypoint } from "@lucid-ideas/agent-kit";
const { app, addEntrypoint } = createAgentApp({
  name: "cross-dex-arbitrage-alert",
  version: "0.1.0",
  description: "Detect cross-DEX token price spreads",
});

addEntrypoint