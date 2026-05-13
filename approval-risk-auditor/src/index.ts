/**
 * Approval Risk Auditor - Main Agent Entry Point
 *
 * Scans wallet addresses for risky ERC-20 token approvals across multiple chains.
 * Identifies unlimited allowances, stale approvals, and generates revocation tx data.
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { auditApprovals } from "./auditor.js";
import { encodeRevokeTxData, type ApprovalRecord, type RiskFlag, type RevokeTxData } from "./approval-types.js";

// ─── Payment config (USDC on Base) ────────────────────────────────────────────
const PAYMENTS = {
  payTo: "0x0000000000000000000000000000000000000000" as const,
  facilitatorUrl: "https://pay.x402.org" as const,
  network: "base" as const,
  defaultPrice: "0.01",
};

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const ChainId = z.union([
  z.literal(1),    // Ethereum
  z.literal(56),   // BSC
  z.literal(137),  // Polygon
  z.literal(42161),// Arbitrum
  z.literal(10),   // Optimism
  z.literal(8453), // Base
  z.literal(43114),// Avalanche
  z.literal(250),  // Fantom
  z.literal(100),  // Gnosis
]);

const AuditInput = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid Ethereum address"),
  chains: z.array(ChainId).min(1, "At least one chain required"),
});

const RiskFlagSchema = z.object({
  type: z.enum([
    "unlimited_allowance",
    "stale_approval",
    "high_value_allowance",
    "unknown_spender",
    "suspicious_contract",
    "nft_approval",
    "approver_not_owner",
  ]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  message: z.string(),
});

const ApprovalSchema = z.object({
  token_address: z.string(),
  token_symbol: z.string().optional(),
  token_name: z.string().optional(),
  spender: z.string(),
  chain_id: z.number(),
  amount: z.string(),
  is_unlimited: z.boolean(),
  last_updated_block: z.number().optional(),
});

const RevokeTxSchema = z.object({
  approval_index: z.number(),
  token_address: z.string(),
  spender: z.string(),
  chain_id: z.number(),
  to: z.string(),
  data: z.string(),
  value: z.string(),
  gas_estimate: z.string().optional(),
});

const AuditOutput = z.object({
  approvals: z.array(ApprovalSchema),
  risk_flags: z.array(z.object({
    approval_index: z.number(),
    flags: z.array(RiskFlagSchema),
  })),
  revoke_tx_data: z.array(RevokeTxSchema),
  summary: z.object({
    total_approvals: z.number(),
    critical_risks: z.number(),
    high_risks: z.number(),
    medium_risks: z.number(),
    low_risks: z.number(),
    chains_scanned: z.array(z.number()),
  }),
});

// ─── Create agent app ─────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp(
  {
    name: "approval-risk-auditor",
    version: "1.0.0",
    description:
      "Audit wallet ERC-20 token approvals across multiple EVM chains. Identifies unlimited allowances, stale approvals, and generates revocation transaction data.",
  },
  { payments: PAYMENTS }
);

// ─── Entrypoint: audit ────────────────────────────────────────────────────────

addEntrypoint({
  key: "audit",
  description:
    "Scan a wallet for ERC-20 token approvals across specified chains and return risk assessment with revocation data.",
  input: AuditInput,
  output: AuditOutput,
  price: "0.01",
  async handler({ input }) {
    const walletAddr = input.wallet.toLowerCase() as `0x${string}`;
    const chains = input.chains;

    const startTime = Date.now();

    // Run audit across all requested chains
    const approvals: ApprovalRecord[] = await auditApprovals(walletAddr, chains);

    // Analyze risk flags for each approval
    const riskAnalysis = analyzeRisks(approvals);

    // Generate revocation transaction data
    const revokeTxs: RevokeTxData[] = approvals.map((approval, idx) =>
      encodeRevokeTxData(approval, idx)
    );

    // Build summary
    const allFlags = riskAnalysis.flatMap((r) => r.flags);
    const summary = {
      total_approvals: approvals.length,
      critical_risks: allFlags.filter((f) => f.severity === "critical").length,
      high_risks: allFlags.filter((f) => f.severity === "high").length,
      medium_risks: allFlags.filter((f) => f.severity === "medium").length,
      low_risks: allFlags.filter((f) => f.severity === "low").length,
      chains_scanned: chains,
    };

    const elapsed = Date.now() - startTime;

    return {
      output: {
        approvals: approvals.map((a) => ({
          token_address: a.tokenAddress,
          token_symbol: a.tokenSymbol,
          token_name: a.tokenName,
          spender: a.spender,
          chain_id: a.chainId,
          amount: a.amount,
          is_unlimited: a.isUnlimited,
          last_updated_block: a.lastUpdatedBlock,
        })),
        risk_flags: riskAnalysis.map((r) => ({
          approval_index: r.approvalIndex,
          flags: r.flags,
        })),
        revoke_tx_data: revokeTxs,
        summary,
      },
      usage: {
        total_tokens: approvals.length * 50 + Math.floor(elapsed / 10),
      },
    };
  },
});

// ─── Risk analysis logic ──────────────────────────────────────────────────────

interface RiskAnalysisResult {
  approvalIndex: number;
  flags: RiskFlag[];
}

/**
 * Analyze a list of approvals and assign risk flags.
 */
function analyzeRisks(approvals: ApprovalRecord[]): RiskAnalysisResult[] {
  return approvals.map((approval, idx) => {
    const flags: RiskFlag[] = [];

    // Unlimited allowance check
    if (approval.isUnlimited) {
      flags.push({
        type: "unlimited_allowance",
        severity: "critical",
        message: `Unlimited approval (${approval.MAX_UINT256}) granted to ${approval.spender}`,
      });
    }

    // Stale approval check (approvals older than 6 months / ~1.8M blocks on Ethereum)
    if (approval.lastUpdatedBlock && approval.currentBlock) {
      const blockAge = approval.currentBlock - approval.lastUpdatedBlock;
      const staleThreshold = getStaleBlockThreshold(approval.chainId);
      if (blockAge > staleThreshold) {
        flags.push({
          type: "stale_approval",
          severity: "medium",
          message: `Approval has not been used in ${blockAge.toLocaleString()} blocks (last updated at block ${approval.lastUpdatedBlock})`,
        });
      }
    }

    // Unknown spender check
    if (approval.spenderIsContract === false) {
      flags.push({
        type: "unknown_spender",
        severity: "low",
        message: "Spender appears to be an EOA rather than a verified contract",
      });
    }

    // Suspicious contract patterns
    if (approval.spenderIsContract && approval.spenderHasCode && !approval.spenderIsVerified) {
      flags.push({
        type: "suspicious_contract",
        severity: "high",
        message: `Spender contract ${approval.spender} is not a verified popular DeFi protocol`,
      });
    }

    // High value allowance (not unlimited but significant)
    if (!approval.isUnlimited) {
      try {
        const value = BigInt(approval.amount);
        if (value > 0n) {
          flags.push({
            type: "high_value_allowance",
            severity: approval.isUnlimited ? "critical" : "medium",
            message: `Non-zero allowance of ${approval.amount} tokens granted`,
          });
        }
      } catch {
        // amount parse error - skip
      }
    }

    return { approvalIndex: idx, flags };
  });
}

/**
 * Get block threshold for "stale" approvals per chain.
 * Approximate 6 months of blocks.
 */
function getStaleBlockThreshold(chainId: number): number {
  const thresholds: Record<number, number> = {
    1: 2_190_000,      // Ethereum: ~12s block time
    56: 12_960_000,    // BSC: ~3s block time
    137: 5_256_000,    // Polygon: ~2s block time
    42161: 2_628_000,  // Arbitrum: ~0.25s block time
    10: 2_190_000,     // Optimism: ~2s block time
    8453: 2_628_000,   // Base: ~2s block time
    43114: 1_314_000,  // Avalanche: ~2s block time
    250: 2_628_000,    // Fantom: ~1s block time
    100: 2_628_000,    // Gnosis: ~5s block time
  };
  return thresholds[chainId] ?? 2_628_000;
}

export default app;
