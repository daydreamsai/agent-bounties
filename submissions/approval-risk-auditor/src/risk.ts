/**
 * Risk analysis engine — v0.2.1
 * Fixed: HIGH_VALUE_THRESHOLD to ~$10,000 equivalent. Complete generateSummary.
 */

import { Approval, RiskFlag, KNOWN_SPENDERS } from "./types.js";

const STALE_DAYS = 180;
const UNLIMITED_RISK_BONUS = 40;
// ~10,000 units worth (1e4 * 1e18 = 1e22 for 18-decimal tokens)
const HIGH_VALUE_THRESHOLD = BigInt(10) ** BigInt(22);

export function calculateRiskScore(approval: Approval): number {
  let score = 0;

  if (approval.isUnlimited) {
    score += UNLIMITED_RISK_BONUS;
  }

  const now = Math.floor(Date.now() / 1000);
  const ageDays = (now - approval.timestamp) / 86400;
  if (ageDays > STALE_DAYS) {
    score += Math.min(30, Math.floor(ageDays / 30));
  }

  const isKnown = KNOWN_SPENDERS[approval.spender.toLowerCase()] !== undefined;
  if (!isKnown && approval.amount !== "0") {
    score += 20;
  }

  if (!approval.isUnlimited && BigInt(approval.amount) > HIGH_VALUE_THRESHOLD) {
    score += 15;
  }

  if (approval.amount === "0" || BigInt(approval.amount) === BigInt(0)) {
    score = 0;
  }

  return Math.min(100, score);
}

export function getSeverity(score: number): "critical" | "high" | "medium" | "low" | "info" {
  if (score >= 80) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  if (score >= 1) return "low";
  return "info";
}

export function generateRiskFlags(
  approvals: Approval[]
): { flags: RiskFlag[]; score: number }[] {
  return approvals.map((approval, idx) => {
    const flags: RiskFlag[] = [];
    const now = Math.floor(Date.now() / 1000);
    const ageDays = (now - approval.timestamp) / 86400;
    const spenderName = KNOWN_SPENDERS[approval.spender.toLowerCase()];

    if (approval.isUnlimited) {
      flags.push({
        approvalIndex: idx, severity: "critical",
        title: "Unlimited Approval",
        description: `Unlimited ${approval.tokenSymbol} approval to ${
          spenderName || approval.spender.slice(0, 10) + "..."
        }. They can drain your entire wallet.`,
      });
    }

    if (ageDays > STALE_DAYS) {
      const years = Math.floor(ageDays / 365);
      const months = Math.floor((ageDays % 365) / 30);
      const ageStr = years > 0 ? `${years}y ${months}mo` : `${Math.floor(ageDays / 30)}mo`;
      flags.push({
        approvalIndex: idx,
        severity: ageDays > 365 ? "high" : "medium",
        title: `Stale Approval (${ageStr})`,
        description: `Approval is ${Math.floor(ageDays)} days old. ${
          spenderName || "The spender"
        } contract may have been compromised or upgraded since.`,
      });
    }

    if (!spenderName && approval.amount !== "0" && !approval.isUnlimited) {
      flags.push({
        approvalIndex: idx, severity: "medium",
        title: "Unknown Spender",
        description: `Approval to unrecognized address ${approval.spender.slice(0, 10)}... No known protocol identified.`,
      });
    }

    if (!approval.isUnlimited && BigInt(approval.amount) > HIGH_VALUE_THRESHOLD) {
      const scale = BigInt(10) ** BigInt(approval.tokenDecimals);
      const formatted = (BigInt(approval.amount) / scale).toString();
      flags.push({
        approvalIndex: idx, severity: "high",
        title: "Large Approval Amount",
        description: `${formatted} ${approval.tokenSymbol} approved to a single spender — excessive exposure.`,
      });
    }

    if (flags.length === 0) {
      flags.push({
        approvalIndex: idx, severity: "info",
        title: "Safe Approval",
        description: `Approval to ${spenderName || "known protocol"}. No risk detected.`,
      });
    }

    return { flags, score: calculateRiskScore(approval) };
  });
}

export function generateSummary(
  approvals: Approval[],
  results: { flags: RiskFlag[]; score: number }[],
  chainsScanned: string[]
) {
  const totalApprovals = approvals.length;
  const unlimitedCount = approvals.filter(a => a.isUnlimited).length;
  const staleCount = results.filter(r =>
    r.flags.some(f => f.title.startsWith("Stale"))
  ).length;
  const criticalCount = results.filter(r => getSeverity(r.score) === "critical").length;
  const highCount = results.filter(r => getSeverity(r.score) === "high").length;
  const totalRisk = results.reduce((sum, r) => sum + r.score, 0);
  const overallRiskScore = Math.min(100, Math.round(totalRisk / Math.max(1, totalApprovals)));

  return {
    totalApprovals, unlimitedCount, staleCount,
    criticalCount, highCount, chainsScanned, overallRiskScore,
  };
}
