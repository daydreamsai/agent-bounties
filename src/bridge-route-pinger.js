import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import axios from "axios";

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "0.1.0",
  description: "List viable bridge routes and live fee/time quotes for token transfers.",
});

// Mock aggregator for bridge paths (e.g. Lifi, Bungee, Socket)
async function fetchBridgeRoutes(token, amount, fromChain, toChain) {
  // In production, we'd hit the Socket API /quote endpoint
  // Simulating the response
  return [
    {
      bridgeName: "Across",
      etaMinutes: 2,
      feeUsd: 1.50,
      requirements: "Requires native gas on destination chain for final execution."
    },
    {
      bridgeName: "Stargate",
      etaMinutes: 5,
      feeUsd: 0.80,
      requirements: "None"
    }
  ];
}

addEntrypoint({
  key: "ping_routes",
  description: "Return best bridge paths for given token and chains",
  input: z.object({
    token: z.string(),
    amount: z.string(),
    from_chain: z.string(),
    to_chain: z.string(),
  }),
  async handler({ input }) {
    const rawRoutes = await fetchBridgeRoutes(
      input.token,
      input.amount,
      input.from_chain,
      input.to_chain
    );

    const routes = [];
    const eta_minutes = [];
    const fee_usd = [];
    const requirements = [];

    // Sort by fee for best route processing
    rawRoutes.sort((a, b) => a.feeUsd - b.feeUsd);

    for (const route of rawRoutes) {
      routes.push(route.bridgeName);
      eta_minutes.push(route.etaMinutes);
      fee_usd.push(route.feeUsd.toString());
      requirements.push(route.requirements);
    }

    return {
      output: {
        routes,
        eta_minutes,
        fee_usd,
        requirements,
      },
      usage: { total_tokens: 125 },
    };
  },
});

export default app;