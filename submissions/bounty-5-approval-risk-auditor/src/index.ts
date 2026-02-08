import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { auditApprovals } from "./approvals.js";

const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "1.0.0",
  description: "Audit ERC20 token approvals for risk — detect unlimited approvals to risky contracts",
});

addEntrypoint({
  key: "audit",
  description: "Audit a wallet's ERC20 token approvals for risk",
  input: z.object({
    wallet: z.string().describe("Wallet address to audit"),
    chain_id: z.number().optional().default(8453).describe("Chain ID (default: Base)"),
    tokens: z.array(z.string()).optional().describe("Specific tokens to check (or auto-detect)"),
  }),
  output: z.object({
    wallet: z.string(),
    chain_id: z.number(),
    total_approvals: z.number(),
    high_risk: z.number(),
    approvals: z.array(z.object({
      token: z.string(),
      spender: z.string(),
      allowance: z.string(),
      is_unlimited: z.boolean(),
      risk_level: z.enum(["low", "medium", "high", "critical"]),
      reason: z.string(),
    })),
    summary: z.string(),
  }),
  async handler({ input }) {
    const result = await auditApprovals(
      input.wallet,
      input.chain_id ?? 8453,
      input.tokens
    );
    return { output: result, usage: { total_tokens: 1 } };
  },
});

addEntrypoint({
  key: "health",
  description: "Health check",
  input: z.object({}),
  async handler() {
    return {
      output: { status: "ok", supported_chains: [{ id: 8453, name: "base" }], version: "1.0.0" },
      usage: { total_tokens: 0 },
    };
  },
});

export default app;
