import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isUnlimited, padAddr, unpadTopic, buildRevokeTxData, lower,
  type Approval,
} from "../src/auditor.ts";
import { encodeFunctionData, erc20Abi } from "viem";

const MAX = "0x" + "f".repeat(64);
const ZERO = "0x" + "0".repeat(64);

test("padAddr 生成 32 字节 topic", () => {
  assert.equal(
    padAddr("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"),
    "0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045"
  );
});

test("unpadTopic 从 topic 取回地址", () => {
  assert.equal(
    unpadTopic("0x00000000000000000000000068b3465833fb72a70ecdf485e0e4c7bd8665fc45"),
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45"
  );
});

test("isUnlimited 识别 MAX_UINT256 与接近 MAX", () => {
  assert.equal(isUnlimited(MAX), true);
  // 阈值 = 95% * (2^256-1) ≈ 1.9 * 2^255
  const near = (2n ** 256n - 1n) * 99n / 100n;   // 99% of MAX  → unlimited
  assert.equal(isUnlimited("0x" + near.toString(16).padStart(64, "0")), true);
  // 50% of MAX → 不是 unlimited
  assert.equal(isUnlimited("0x" + (2n ** 255n).toString(16).padStart(64, "0")), false);
  // 1e21 级别 → 远低于阈值
  assert.equal(isUnlimited("0x" + (10n ** 21n).toString(16).padStart(64, "0")), false);
  assert.equal(isUnlimited(ZERO), false);
});

test("revoke calldata = approve(spender, 0)", () => {
  const approvals: Approval[] = [{
    token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    token_symbol: "USDC",
    token_decimals: 6,
    owner: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    spender: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
    raw_value: MAX,
    value: (2n ** 256n - 1n).toString(),
    unlimited: true,
    source: "logs",
  }];
  const txs = buildRevokeTxData(approvals);
  assert.equal(txs.length, 1);
  assert.equal(txs[0].to, approvals[0].token);
  const expected = encodeFunctionData({
    abi: erc20Abi, functionName: "approve",
    args: [approvals[0].spender as `0x${string}`, 0n],
  });
  assert.equal(txs[0].data, expected);
  assert.equal(txs[0].data.startsWith("0x095ea7b3"), true); // approve selector
});

test("额度为 0 的 approval 不产生 revoke 交易", () => {
  const txs = buildRevokeTxData([{
    token: "0xaaa", token_symbol: "T", token_decimals: 18, owner: "0x1", spender: "0x2",
    raw_value: ZERO, value: "0", unlimited: false, source: "allowance",
  }]);
  assert.equal(txs.length, 0);
});

test("lower 归一化地址", () => {
  assert.equal(lower("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
});
