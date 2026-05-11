/**
 * Revoke transaction builder — generates calldata for ERC-20/ERC-721/ERC-1155 revocations.
 */

import { Approval, RevokeTxData, KNOWN_SPENDERS } from "./types.js";

/**
 * ERC-20 approve(spender, 0) function selector: 0x095ea7b3
 */
const ERC20_APPROVE_SELECTOR = "0x095ea7b3";
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

/**
 * ERC-721 setApprovalForAll(operator, false) selector: 0xa22cb465
 */
const ERC721_SET_APPROVAL_SELECTOR = "0xa22cb465";

/**
 * Build ERC-20 revoke calldata: approve(spender, 0)
 */
function buildERC20RevokeCalldata(spender: string): string {
  return ERC20_APPROVE_SELECTOR +
    "000000000000000000000000" + spender.slice(2) +
    "0000000000000000000000000000000000000000000000000000000000000000";
}

/**
 * Build ERC-721 revoke calldata: setApprovalForAll(operator, false)
 */
function buildERC721RevokeCalldata(spender: string): string {
  return ERC721_SET_APPROVAL_SELECTOR +
    "000000000000000000000000" + spender.slice(2) +
    "0000000000000000000000000000000000000000000000000000000000000000";
}

/**
 * Generate revoke transaction data for flagged approvals
 */
export function buildRevokeTransactions(
  approvals: Approval[],
  riskScores: number[]
): RevokeTxData[] {
  const revokes: RevokeTxData[] = [];

  // Filter approvals that need revocation (score > 0, amount !== 0)
  const flaggedApprovals = approvals
    .map((a, i) => ({ approval: a, score: riskScores[i], index: i }))
    .filter(({ score, approval }) => score > 0 && BigInt(approval.amount) > BigInt(0));

  for (const { approval } of flaggedApprovals) {
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
      const data = buildERC721RevokeCalldata(approval.spender);
      revokes.push({
        chain: approval.chain,
        chainId: approval.chainId,
        tokenAddress: approval.tokenAddress,
        spender: approval.spender,
        tokenType: approval.tokenType,
        to: approval.tokenAddress,
        data,
        value: "0x0",
        description: `Revoke ${approval.tokenType} collection approval for ${spenderName || approval.spender.slice(0, 10) + "..."}`,
      });
    }
  }

  return revokes;
}

/**
 * Generate batch revoke transaction (calls multiple revokes in one tx)
 * Uses a simple multicall pattern or returns individual txns for better UX
 */
export function buildBatchRevoke(
  revokes: RevokeTxData[]
): { individual: RevokeTxData[]; count: number } {
  return {
    individual: revokes,
    count: revokes.length,
  };
}
