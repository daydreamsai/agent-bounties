/**
 * Warden: Approval Risk Auditor
 *
 * Entrypoint-based agent that scans EVM wallets for risky token approvals
 * and generates revocation transaction data.
 *
 * Bounty: $1000 — daydreamsai/agent-bounties#5
 *
 * Inputs:
 *   wallet: Wallet address to audit
 *   chains: EVM chains to scan (ethereum, polygon, bsc, arbitrum, optimism, base, avalanche)
 *
 * Returns:
 *   approvals[]      - All approvals found
 *   risk_flags[]     - Risk indicators per approval
 *   revoke_tx_data[] - Ready-to-use revoke transaction calldata
 *   summary          - Overall risk assessment
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { CHAINS, getChain, getApiKey } from "./chains.js";
import { scanChain } from "./scanner.js";
import {
  calculateRiskScore,
  generateRiskFlags,
  generateSummary,
  getSeverity,
} from "./risk.js";
import {
  buildRevokeTransactions,
} from "./revoke.js";
import { AuditResult, RiskFlag, RevokeTxData } from "./types.js";

const { app, addEntrypoint } = createAgentApp({
  name: "approval-risk-auditor",
  version: "0.2.0",
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
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
    chains: z
      .array(
        z.enum([
          "ethereum",
          "polygon",
          "bsc",
          "arbitrum",
          "optimism",
          "base",
          "avalanche",
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

    const allApprovals: AuditResult["approvals"] = [];
    const chainResults: {
      approvals: AuditResult["approvals"];
      flags: { flags: RiskFlag[]; score: number }[];
    }[] = [];
    const chainsScanned: string[] = [];

    // Scan each requested chain
    for (const chainName of chains) {
      const chain = getChain(chainName);
      if (!chain) continue;

      const apiKey = getApiKey(chain);
      if (!apiKey) continue;

      try {
        const approvals = await scanChain(chain, wallet);
        const flags = generateRiskFlags(approvals);

        allApprovals.push(...approvals);
        chainResults.push({ approvals, flags });
        chainsScanned.push(chainName);
      } catch (err) {
        // Chain scan failed, skip it
        continue;
      }
    }

    // Build risk scores array
    const riskScores = allApprovals.map((_, idx) => {
      // Find the matching risk result
      let offset = 0;
      for (const cr of chainResults) {
        if (idx < offset + cr.approvals.length) {
          return cr.flags[idx - offset].score;
        }
        offset += cr.approvals.length;
      }
      return 0;
    });

    // Flatten all risk flags
    const allRiskFlags: RiskFlag[] = [];
    for (const cr of chainResults) {
      for (const rf of cr.flags) {
        allRiskFlags.push(...rf.flags);
      }
    }

    // Build revoke transactions
    const revokeTxData = buildRevokeTransactions(allApprovals, riskScores);

    // Generate summary
    const summary = generateSummary(allApprovals, chainResults.flatMap(cr => cr.flags), chainsScanned);

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
