/**
 * Warden: Approval Risk Auditor v0.2.1
 *
 * Entrypoint-based agent that scans EVM wallets for risky token approvals
 * and generates revocation transaction data.
 *
 * Bounty: $1000 — daydreamsai/agent-bounties#5
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { CHAINS, getChain, getApiKey } from "./chains.js";
import { scanChain } from "./scanner.js";
import {
  calculateRiskScore,
  generateRiskFlags,
  generateSummary,
} from "./risk.js";
import {
  buildRevokeTransactions,
} from "./revoke.js";
import { AuditResult, RiskFlag } from "./types.js";

const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "0.2.1",
  description:
    "Flag unlimited or stale ERC-20 / NFT approvals and build revoke calls. Supports 7 EVM chains.",
});

addEntrypoint({
  key: "audit-approvals",
  description:
    "Audit wallet approvals across multiple EVM chains. Returns detected approvals, risk flags, and ready-to-use revoke transaction data.",

  input: z.object({
    wallet: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .transform(w => w.toLowerCase()),
    chains: z
      .array(
        z.enum([
          "ethereum", "polygon", "bsc", "arbitrum",
          "optimism", "base", "avalanche",
        ])
      )
      .min(1, "At least one chain required")
      .max(7, "Maximum 7 chains per scan"),
  }),

  async handler({ input }): Promise<{
    output: AuditResult;
    usage: { total_tokens: string };
  }> {
    const { wallet, chains } = input;
    const startTime = Date.now();

    // Scan chains in parallel with individual error handling
    const scanResults = await Promise.allSettled(
      chains.map(async (chainName) => {
        const chain = getChain(chainName);
        if (!chain) throw new Error(`Unknown chain: ${chainName}`);
        const apiKey = getApiKey(chain);
        if (!apiKey) throw new Error(`No API key for ${chainName}`);

        const approvals = await scanChain(chain, wallet);
        return { chainName, approvals };
      })
    );

    // Collect results
    const allApprovals: AuditResult["approvals"] = [];
    const chainsScanned: string[] = [];

    for (const result of scanResults) {
      if (result.status === "fulfilled") {
        allApprovals.push(...result.value.approvals);
        chainsScanned.push(result.value.chainName);
      }
    }

    if (allApprovals.length === 0) {
      return {
        output: {
          wallet,
          approvals: [],
          riskFlags: [],
          revokeTxData: [],
          summary: {
            totalApprovals: 0,
            unlimitedCount: 0,
            staleCount: 0,
            criticalCount: 0,
            highCount: 0,
            chainsScanned,
            overallRiskScore: 0,
          },
        },
        usage: {
          total_tokens: `Scan completed across ${chainsScanned.length} chain(s). No approvals found.`,
        },
      };
    }

    // Generate risk scores for each approval
    const riskScores = allApprovals.map((approval) =>
      calculateRiskScore(approval)
    );

    // Generate flags
    const flaggedResults = generateRiskFlags(allApprovals);

    // Flatten all risk flags
    const allRiskFlags: RiskFlag[] = [];
    for (const fr of flaggedResults) {
      allRiskFlags.push(...fr.flags);
    }

    // Build revoke transactions
    const revokeTxData = buildRevokeTransactions(allApprovals, riskScores);

    // Generate summary
    const summary = generateSummary(allApprovals, flaggedResults, chainsScanned);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
      output: {
        wallet,
        approvals: allApprovals,
        riskFlags: allRiskFlags,
        revokeTxData,
        summary,
      },
      usage: {
        total_tokens: `Scan completed in ${elapsed}s across ${chainsScanned.length} chain(s). Found ${allApprovals.length} approvals, ${revokeTxData.length} need revocation.`,
      },
    };
  },
});

export default app;
