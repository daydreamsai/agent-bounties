/**
 * agent-kit 应用装配：把 Approval Risk Auditor 暴露成 x402 可达的 agent。
 *
 * 依据 issue #5 规范（daydreamsai/agent-bounties#5）：
 *   Inputs : wallet (string), chains (string[] 可选)
 *   Returns: approvals[] / risk_flags[] / revoke_tx_data[]
 *   硬性要求: 部署到域名且经 x402 可达
 *
 * x402 由 agent-kit 自动完成（withPayments 中间件）:
 *   - FACILITATOR_URL  默认 https://facilitator.daydreams.systems
 *   - ADDRESS          收款地址（USDC 所在网络）
 *   - NETWORK          默认 base-sepolia
 *   - DEFAULT_PRICE    单价（**美元**！x402 会 ×10^6 变成链上 atomic amount）
 *                      0.0025 = $0.0025/次 = 2500 atomic units
 *                      ⚠️ 写成 "2500" 会被当成 2500 美元/次
 */

import { z } from "zod";
import { createAgentApp, paymentsFromEnv } from "@lucid-dreams/agent-kit";
import { auditWallet } from "./auditor.js";

export const AGENT_META = {
  name: "approval-risk-auditor",
  version: "0.1.0",
  description:
    "Audits an EVM wallet for risky ERC-20/ERC-721 token approvals (unlimited, stale, direct) " +
    "and returns ready-to-submit revoke transaction calldata.",
};

const auditInput = z.object({
  wallet: z.string().describe("Owner wallet address to audit (0x…)"),
  chains: z
    .array(z.number().int())
    .optional()
    .describe("Chain ids to scan. Default [1] (Ethereum mainnet). Multi-chain requires ETHERSCAN_API_KEY."),
  mode: z
    .enum(["logs", "etherscan"])
    .optional()
    .describe("Data source: 'logs' (no API key needed) or 'etherscan' (full history, needs key)."),
});

const auditOutput = z.object({
  chain_id: z.number(),
  wallet: z.string(),
  mode: z.string(),
  summary: z.object({
    total_approvals: z.number(),
    unlimited_count: z.number(),
    stale_count: z.number(),
    high_severity_count: z.number(),
  }),
  approvals: z.array(z.object({
    token: z.string(),
    token_symbol: z.string(),
    token_decimals: z.number(),
    owner: z.string(),
    spender: z.string(),
    raw_value: z.string(),
    value: z.string(),
    unlimited: z.boolean(),
    last_approved_at: z.number().nullable().optional(),
    source: z.string(),
  })),
  risk_flags: z.array(z.object({
    approval_index: z.number(),
    token: z.string(),
    token_symbol: z.string(),
    spender: z.string(),
    risk: z.string(),
    detail: z.string(),
    severity: z.string(),
  })),
  revoke_tx_data: z.array(z.object({
    token: z.string(),
    spender: z.string(),
    to: z.string(),
    data: z.string(),
    human_readable: z.string(),
  })),
  notes: z.array(z.string()),
});

export function buildApp() {
  const { app, addEntrypoint, config } = createAgentApp(AGENT_META, {
    // payments 由 env 决定；没配 ADDRESS/PRICE 时不启用 paywall（本地调试友好）
    // ⚠️ x402 的 price 单位是 **美元**（USDC），最终会 ×10^6 变成链上 atomic amount。
    //    所以 0.0025 = $0.0025/次（= 2500 atomic units），写成 "2500" 会变成 2500 美元！
    payments: paymentsFromEnv({ defaultPrice: process.env.DEFAULT_PRICE || "0.0025" }),
  });

  addEntrypoint({
    key: "audit",
    description:
      "Audit an EVM wallet for unlimited / stale / risky token approvals and return revoke calldata.",
    input: auditInput,
    output: auditOutput,
    price: process.env.ENTRYPOINT_PRICE || undefined,
    async handler({ input }: { input: z.infer<typeof auditInput> }) {
      const result = await auditWallet({
        wallet: input.wallet,
        chains: input.chains,
        mode: input.mode,
        etherscan_api_key: process.env.ETHERSCAN_API_KEY,
      });
      return {
        output: result,
        usage: { total_tokens: result.approvals.length + result.risk_flags.length },
      };
    },
  });

  // 规范模板里的 echo 入口（保留，便于健康检查与连通性自测）
  addEntrypoint({
    key: "echo",
    description: "Echo a message",
    input: z.object({ text: z.string() }),
    async handler({ input }: { input: { text?: string } }) {
      return {
        output: { text: String(input.text ?? "") },
        usage: { total_tokens: (input.text ?? "").length },
      };
    },  });

  return { app, config };
}

export const { app } = buildApp();
export default app;
