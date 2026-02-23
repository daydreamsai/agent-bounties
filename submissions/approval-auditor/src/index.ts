import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { auditApprovals } from "./logic.js";

// Note: The agent-kit SDK's .d.ts files reference an internal zod build whose
// ZodObject type is structurally incompatible with the project-level zod.
// The runtime behaviour is fully correct; the `as any` casts silence the
// type-checker for the SDK boundary only.

const { app, addEntrypoint } = createAgentApp(
  {
    name: "approval-auditor",
    version: "1.0.0",
    description:
      "Audit token approval risks and generate revocation transactions",
  },
  {
    payments: {
      payTo:
        (process.env.ADDRESS as `0x${string}`) ||
        "0x0000000000000000000000000000000000000000",
      network: (process.env.NETWORK as any) || "base-sepolia",
      defaultPrice: process.env.DEFAULT_PRICE || "1000",
    } as any,
  }
);

/* ------------------------------------------------------------------ */
/*  Schemas                                                           */
/* ------------------------------------------------------------------ */

const ApprovalSchema = z.object({
  token: z.string(),
  token_symbol: z.string(),
  spender: z.string(),
  spender_label: z.string(),
  allowance: z.string(),
  is_unlimited: z.boolean(),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  chain: z.string(),
});

const RevokeTxSchema = z.object({
  token: z.string(),
  spender: z.string(),
  chain: z.string(),
  to: z.string(),
  data: z.string(),
  description: z.string(),
});

const AuditOutputSchema = z.object({
  wallet: z.string(),
  total_approvals: z.number(),
  critical_count: z.number(),
  high_count: z.number(),
  approvals: z.array(ApprovalSchema),
  revoke_tx_data: z.array(RevokeTxSchema),
});

/* ------------------------------------------------------------------ */
/*  Entrypoints                                                       */
/* ------------------------------------------------------------------ */

addEntrypoint({
  key: "audit",
  description: "Audit wallet token approvals for risks",
  input: z.object({
    wallet: z.string().describe("Wallet address to audit"),
    chains: z
      .array(z.string())
      .describe("Chains to scan, e.g. ['base']"),
  }) as any,
  output: AuditOutputSchema as any,
  handler: async ({ input }: any) => {
    const result = await auditApprovals(input);
    return { output: result };
  },
});

addEntrypoint({
  key: "health",
  description: "Health check",
  input: z.object({}) as any,
  output: z.object({ status: z.string(), timestamp: z.number() }) as any,
  handler: async () => ({
    output: { status: "ok", timestamp: Date.now() },
  }),
});

export default app;
