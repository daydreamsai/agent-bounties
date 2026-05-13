/**
 * Unit tests for approval-types utilities.
 */

import { describe, test, expect } from "bun:test";
import { encodeRevokeTxData, MAX_UINT256 } from "../src/approval-types.js";
import type { ApprovalRecord } from "../src/approval-types.js";

describe("encodeRevokeTxData", () => {
  const sampleApproval: ApprovalRecord = {
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    tokenSymbol: "USDC",
    spender: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    chainId: 1,
    amount: MAX_UINT256,
    isUnlimited: true,
    MAX_UINT256,
  };

  test("should encode valid approve(spender, 0) calldata", () => {
    const result = encodeRevokeTxData(sampleApproval, 0);

    expect(result.approval_index).toBe(0);
    expect(result.token_address).toBe(sampleApproval.tokenAddress);
    expect(result.spender).toBe(sampleApproval.spender);
    expect(result.chain_id).toBe(1);
    expect(result.to).toBe(sampleApproval.tokenAddress);
    expect(result.value).toBe("0x0");
    expect(result.data).toMatch(/^0x095ea7b3/);
    expect(result.data).toContain(
      sampleApproval.spender.toLowerCase().replace("0x", "").padStart(64, "0")
    );
    // Amount should be 0 (64 zeros)
    expect(result.data.substring(10 + 64)).toBe("0".repeat(64));
  });

  test("should have gas estimate", () => {
    const result = encodeRevokeTxData(sampleApproval, 0);
    expect(result.gas_estimate).toBe("46000");
  });

  test("should handle multiple approvals with correct indices", () => {
    const result0 = encodeRevokeTxData(sampleApproval, 0);
    const result1 = encodeRevokeTxData(sampleApproval, 1);

    expect(result0.approval_index).toBe(0);
    expect(result1.approval_index).toBe(1);
  });
});

describe("ApprovalRecord types", () => {
  test("should accept valid approval record", () => {
    const record: ApprovalRecord = {
      tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      tokenSymbol: "USDT",
      spender: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
      chainId: 1,
      amount: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      isUnlimited: true,
      spenderIsContract: true,
      spenderHasCode: true,
      spenderIsVerified: true,
      MAX_UINT256,
    };

    expect(record.isUnlimited).toBe(true);
    expect(record.chainId).toBe(1);
  });

  test("should identify unlimited amounts", () => {
    const unlimited = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect(unlimited.toLowerCase()).toBe(MAX_UINT256.toLowerCase());
  });

  test("should identify limited amounts", () => {
    const limited = "0x0de0b6b3a7640000"; // 1 ETH
    expect(limited.toLowerCase()).not.toBe(MAX_UINT256.toLowerCase());
  });
});
