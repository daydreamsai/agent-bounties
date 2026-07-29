import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "cross-dex-arbitrage-alert",
  version: "0.1.0",
  description: "Cross-DEX arbitrage opportunity detection agent",
});

addEntryp.