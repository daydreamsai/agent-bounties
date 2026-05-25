import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

// Mock bridge data - in a real implementation, this would come from external APIs or services
const MOCK_BRIDGE_ROUTES = [
  {
    name: "Wormhole",
    eta_minutes: 10,
    fee_usd: 5.0,
    requirements: "Gas token (SOL) required on destination chain"
  },
  {
    name: "Socket",
    eta_minutes: 5,
    fee_usd: 2.5,
    requirements: "Gas tokens required for destination chain transactions"
  },
  {
    name: "LayerZero",
    eta_minutes: 15,
    fee_usd: 10.0,
    requirements: "Gas token (ETH) required on source chain"
  }
];

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "0.1.0",
  description: "List viable bridge routes and live fee/time quotes",
});

addEntrypoint({
  key: "get-bridge-routes",
  description: "Get bridge routes for a token transfer",
  input: z.object({
    token: z.string().optional(),
    amount: z.string().optional(),
    from_chain: z.string(),
    to_chain: z.string()
  }),
  async handler({ input }) {
    // In a real implementation, this would call external bridge APIs
    // For now, return mock data
    return {
      output: { routes: MOCK_BRIDGE_ROUTES },
      usage: { total_tokens: "0" }
    };
  },
});

addEntrypoint({
  key: "echo",
  description: "Echo a message",
  input: z.object({ text: z.string() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "") },
      usage: { total_tokens: String(input.text ?? "").length },
    };
  },
});

export default app;