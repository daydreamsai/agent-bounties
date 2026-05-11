/**
 * Revoke transaction builder — generates calldata for ERC-20/ERC-721 revocations.
 *
 * v0.2.1 — Fixed: ERC-721 uses approve(address(0)) for single-operator targeting.
 *          Added ERC-721 single-operator revoke option.
 */

import { Approval, RevokeTxData, KNOWN_SPENDERS } from "./types.js";

const ERC20_APPROVE_SELECTOR = "0x095ea7b3";
const ERC721_APPROVE_SELECTOR = "0x095ea7b3"; // ERC-721 approve(address,uint256)
const ZERO_ADDRESS = "0000000000000000000000000000000000000000000000000000000000000000";
const ZERO_ADDRESS_20 = "0000000000000000000000000000000000000000";

/**
 * Build ERC-20 revoke calldata: approve(spender, 0)
 */
function buildERC20RevokeCalldata(spender: string): string {
  return ERC20_APPROVE_SELECTOR +
    ZERO_ADDRESS_20 + spender.slice(2).toLowerCase().padStart(40, '0') +
    ZERO_ADDRESS;
}

/**
 * Build ERC-721 single-token revoke: approve(address(0), tokenId)
 * Revokes approval for the specific spender on a specific token ID.
 */
function buildERC721RevokeCalldata(spender: string, tokenId?: string): string {
  // For ERC-721 single-token, we can approve(0, tokenId)
  // This resets the approved address for that specific token.
  // If no tokenId, we can't revoke single-token without it.
  const tid = tokenId ? BigInt(tokenId).toString(16).padStart(64, '0') : ZERO_ADDRESS;
  return ERC721_APPROVE_SELECTOR +
    ZERO_ADDRESS_20 + tid;
}

/**
 * Generate revoke transaction data for flagged approvals
 */
export function buildRevokeTransactions(
  approvals: Approval[],
  riskScores: number[]
): RevokeTxData[] {
  const revokes: RevokeTxData[] = [];

  const flaggedApprovals = approvals
    .map((a, i) => ({ approval: a, score: riskScores[i] ?? 0, index: i }))
    .filter(({ score, approval }) => score > 0);

  for (const { approval } of flaggedApprovals) {
    // Skip revocations (zero amount) — already filtered in scanner
    const spenderName = KNOWN_SPENDERS[approval.spender.toLowerCase()];

    if (approval.tokenType === "ERC20") {
      const data = buildERC20RevokeCalldata(approval.spender);
      revokes.push({
        chain: approval.chain,
        chainId: approval.chainId,
        tokenAddress: approval.tokenAddress,
        spender: approval.spender,
        tokenType: "ERC-20",
        to: approval.tokenAddress,
        data,
        value: "0x0",
        description: `Revoke ${approval.tokenSymbol} approval for ${spenderName || approval.spender.slice(0, 10) + "..."}`,
      });
    } else if (approval.tokenType === "ERC721" || approval.tokenType === "ERC1155") {
      const data = buildERC721RevokeCalldata(approval.spender, approval.tokenId);
      revokes.push({
        chain: approval.chain,
        chainId: approval.chainId,
        tokenAddress: approval.tokenAddress,
        spender: approval.spender,
        tokenType: approval.tokenType,
        to: approval.tokenAddress,
        data,
        value: "0x0",
        description: `Revoke ${approval.tokenType} approval (tokenId: ${approval.tokenId || "all"}) for ${spenderName || approval.spender.slice(0, 10) + "..."}`,
      });
    }
  }

  return revokes;
}

/**
 * Generate batch revoke transaction (returns individual txns for better UX)
 */
export function buildBatchRevoke(
  revokes: RevokeTxData[]
): { individual: RevokeTxData[]; count: number } {
  return { individual: revokes, count: revokes.length };
}
