/**
 * Risk analysis engine — evaluates each approval and assigns risk scores.
 */

import { Approval, RiskFlag, KNOWN_SPENDERS } from "./types.js";

const STALE_DAYS = 180; // 6 months
const UNLIMITED_RISK_BONUS = 40;
const HIGH_VALUE_THRESHOLD = BigInt(10) ** BigInt(22); // ~10,000 ETH worth

/**
 * Calculate a risk score (0-100) for a single approval
 */
export function calculateRiskScore(approval: Approval): number {
  let score = 0;

  // Unlimited approvals are inherently risky
  if (approval.isUnlimited) {
    score += UNLIMITED_RISK_BONUS;
  }

  // Stale approvals get higher risk
  const now = Math.floor(Date.now() / 1000);
  const ageDays = (now - approval.timestamp) / 86400;
  if (ageDays > STALE_DAYS) {
    score += Math.min(30, Math.floor(ageDays / 30));
  }

  // Unknown spenders = higher risk
  const isKnown = KNOWN_SPENDERS[approval.spender.toLowerCase()] !== undefined;
  if (!isKnown && approval.amount !== "0") {
    score += 20;
  }

  // Large amounts = higher risk
  if (approval.isUnlimited) {
    // Already handled
  } else if (BigInt(approval.amount) > HIGH_VALUE_THRESHOLD) {
    score += 15;
  }

  // Spam/zero approvals = low risk
  if (approval.amount === "0" || BigInt(approval.amount) === BigInt(0)) {
    score = 0;
  }

  return Math.min(100, score);
}

/**
 * Get severity level from risk score
 */
export function getSeverity(score: number): "critical" | "high" | "medium" | "low" | "info" {
  if (score >= 80) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  if (score >= 1) return "low";
  return "info";
}

/**
 * Generate human-readable risk flags for each approval
 */
export function generateRiskFlags(
  approvals: Approval[]
): { flags: RiskFlag[]; score: number }[] {
  return approvals.map((approval, idx) => {
    const flags: RiskFlag[] = [];
    const now = Math.floor(Date.now() / 1000);
    const ageDays = (now - approval.timestamp) / 86400;
    const spenderName = KNOWN_SPENDERS[approval.spender.toLowerCase()];

    // Flag: Unlimited
    if (approval.isUnlimited) {
      flags.push({
        approvalIndex: idx,
        severity: "critical",
        title: "Unlimited Approval",
        description: `Unlimited token approval granted to ${
          spenderName || approval.spender.slice(0, 10) + "..."
        }. This allows them to spend all your ${approval.tokenSymbol} tokens.`,
      });
    }

    // Flag: Stale
    if (ageDays > STALE_DAYS) {
      const years = Math.floor(ageDays / 365);
      const months = Math.floor((ageDays % 365) / 30);
      const ageStr = years > 0 ? `${years}y ${months > 0 ? months + "mo" : ""}` : `${Math.floor(ageDays / 30)}mo`;
      flags.push({
        approvalIndex: idx,
        severity: ageDays > 365 ? "high" : "medium",
        title: `Stale Approval (${ageStr})`,
        description: `This approval is ${Math.floor(ageDays)} days old. Dormant approvals increase attack surface if the spender contract is compromised.`,
      });
    }

    // Flag: Unknown Spender
    if (!spenderName && approval.amount !== "0" && !approval.isUnlimited) {
      flags.push({
        approvalIndex: idx,
        severity: "medium",
        title: "Unknown Spender",
        description: `Approval granted to an unrecognized address: ${approval.spender.slice(0, 10)}... No known protocol identified for this spender.`,
      });
    }

    // Flag: Large Approval
    if (!approval.isUnlimited && BigInt(approval.amount) > HIGH_VALUE_THRESHOLD) {
      const formatted = (BigInt(approval.amount) / BigInt(10) ** BigInt(approval.tokenDecimals)).toString();
      flags.push({
        approvalIndex: idx,
        severity: "high",
        title: "Large Approval Amount",
        description: `Approval of ${formatted} ${approval.tokenSymbol} is unusually large. Consider using exact amounts.`,
      });
    }

    // Flag: NFT Collection Approval
    if (approval.tokenType !== "ERC20" && approval.isUnlimited) {
      flags.push({
        approvalIndex: idx,
        severity: "high",
        title: `Full ${approval.tokenType} Collection Approval`,
        description: `Marketplace has approval over your entire collection. Revoke if not actively trading.`,
      });
    }

    // If no specific flags, mark as safe
    if (flags.length === 0) {
      flags.push({
        approvalIndex: idx,
        severity: "info",
        title: "Safe Approval",
        description: `Limited approval to ${
          spenderName || "a known protocol"
        }. No immediate risk detected.`,
      });
    }

    return { flags, score: calculateRiskScore(approval) };
  });
}

/**
 * Generate overall summary from audit results
 */
export function generateSummary(
  approvals: Approval[],
  results: { flags: RiskFlag[]; score: number }[],
  chainsScanned: string[]
) {
  const totalApprovals = approvals.length;
  const unlimitedCount = approvals.filter((a) => a.isUnlimited).length;
  const staleCount = results.filter((r) =>
    r.flags.some((f) => f.title.startsWith("Stale"))
  ).length;
  const criticalCount = results.filter((r) => getSeverity(r.score) === "critical").length;
  const highCount = results.filter((r) => getSeverity(r.score) === "high").length;
  const overallRiskScore = Math.min(
    100,
    Math.round(
      (criticalCount * 100 + highCount * 60 + unlimitedCount * 40) /
        Math.max(1, totalApprovals)
    )
  );

  return {
    totalApprovals,
    unlimitedCount,
    staleCount,
    criticalCount,
    highCount,
    chainsScanned,
    overallRiskScore,
  };
}
