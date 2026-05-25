import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "0.1.0",
  description: "List viable bridge routes and live fee/time quotes",
});

// Mock data for bridge routes
const bridgeRoutes = [
  {
    name: "Stargate",
    eta_minutes: 5,
    fee_usd: 2.5,
    requirements: "Gas token (e.g. ETH) required on destination chain"
  },
  {
    name: "Optimism Bridge",
    eta_minutes: 10,
    fee_usd: 1.5,
    requirements: "None"
  }
];

addEntrypoint({
  key: "getBridgeRoutes",
  description: "Get best bridge routes for a token transfer",
  input: z.object({
    token: z.string(),
    amount: z.number(),
    from_chain: z.string(),
    to_chain: z.string()
  }),
  async handler({ input }) {
    const { token, amount, from_chain, to_chain } = input;
    
    // Filter mock bridge routes based on input
    const routes = bridgeRoutes.map(route => {
      // In a real implementation, you would filter based on the input parameters
      // For now, we'll just return the mock data
      return {
        name: route.name,
        eta_minutes: route.eta_minutes,
        fee_usd: route.fee_usd,
        requirements: route.requirements
      };
    });

    return {
      output: { routes },
      usage: { 
        total_tokens: amount.toString().length 
      }
    };
  }
});

// Fallback entrypoint
addEntrypoint({
  key: "fallback",
  description: "Fallback entrypoint",
  input: z.object({}),
  async handler({ input }) {
    return { output: { message: "No routes found" } };
  }
});

export default app;