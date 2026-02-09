import { z } from "zod";

import { createAgentApp } from "@lucid-agents/hono";

import { createAgent } from "@lucid-agents/core";
import { payments, paymentsFromEnv } from "@lucid-agents/payments";
import { getGasRoutes, GasInputSchema } from "./gas-api";

const agent = await createAgent({
  name: process.env.AGENT_NAME ?? "gasroute-oracle",
  version: process.env.AGENT_VERSION ?? "0.1.0",
  description: process.env.AGENT_DESCRIPTION ?? "Choose cheapest chain and timing hint for a swap or contract call",
})
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const { app, addEntrypoint } = await createAgentApp(agent);

// Echo entrypoint (for testing)
addEntrypoint({
  key: "echo",
  description: "Echo input text",
  input: z.object({ text: z.string().min(1, "Please provide some text.") }),
  handler: async (ctx) => {
    const text = (ctx.input as any).text as string;
    return {
      output: {
        text: text,
      },
    };
  },
});

// Gas route oracle entrypoint
addEntrypoint({
  key: "gas-routes",
  description: "Get cheapest chain and gas cost estimates for a transaction",
  input: GasInputSchema,
  handler: async (ctx) => {
    const input = ctx.input as z.infer<typeof GasInputSchema>;
    const routes = await getGasRoutes(
      input.chain_set,
      input.calldata_size_bytes,
      input.gas_units_est
    );
    
    // Return recommended chain (lowest fee) and all routes
    return {
      output: {
        recommended_chain: routes[0]?.chain,
        routes,
      },
    };
  },
});

export { app };
