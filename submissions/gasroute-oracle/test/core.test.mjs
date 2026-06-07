import test from "node:test";
import assert from "node:assert/strict";
import { computeFee, estimateGasRoute, classifyBusyLevel } from "../src/core.js";

test("computeFee includes execution and calldata gas", () => {
  const fee = computeFee({
    gasUnitsEst: 100000,
    calldataSizeBytes: 100,
    baseFeeGwei: 20,
    priorityFeeGwei: 2,
    chain: { calldataGasPerByte: 16, l1DataFeeMultiplier: 0 }
  });

  assert.equal(fee.totalGas, 101600);
  assert.equal(Number(fee.feeNative.toFixed(8)), 0.0022352);
});

test("classifyBusyLevel increases with gas pressure", () => {
  assert.equal(classifyBusyLevel(2, 0.1), "low");
  assert.equal(classifyBusyLevel(20, 2), "medium");
  assert.equal(classifyBusyLevel(45, 3), "high");
  assert.equal(classifyBusyLevel(90, 5), "extreme");
});

test("estimateGasRoute returns the cheapest chain by USD fee", async () => {
  const output = await estimateGasRoute(
    {
      chain_set: ["ethereum", "base"],
      calldata_size_bytes: 120,
      gas_units_est: 150000
    },
    {
      gasOverrides: {
        ethereum: { baseFeeGwei: 30, priorityFeeGwei: 2, source: "test" },
        base: { baseFeeGwei: 0.2, priorityFeeGwei: 0.02, source: "test" }
      },
      priceOverrides: {
        ethereum: 3500
      }
    }
  );

  assert.equal(output.chain, "base");
  assert.equal(output.alternatives[0].chain, "ethereum");
  assert.ok(output.fee_usd < output.alternatives[0].fee_usd);
});

