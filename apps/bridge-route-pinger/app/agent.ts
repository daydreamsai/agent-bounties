import { z } from "zod";
import { createAgentApp, createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "bridge-route-pinger",
  version: "0.1.0",
  description: "List viable bridge routes and live fee/time quotes",
  input: z.object({ 
    text: z.string().optional() 
  }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "") },
      usage: { total_tokens: String(input.text ?? "").length },
    };
  },
});

export default app;