import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeHealthFactor, simulatePriceDrop, classifyRisk, DEFAULT_ALERT_CONFIG } from "../src/calculations.js";
import type { BorrowPosition } from "../src/types.js";

const safePosition: BorrowPosition = {
  protocol: "aave-v3",
  chain: "ethereum",
  collateralAsset: "ETH",
  collateralAmount: 10,
  collateralPriceUsd: 3000,
  borrowAsset: "USDC",
  borrowAmount: 15000,
  borrowPriceUsd: 1,
  liquidationThreshold: 0.85,
  ltv: 0.80,
};

const dangerPosition: BorrowPosition = {
  ...safePosition,
  borrowAmount: 24000,
};

describe("computeHealthFactor", () => {
  it("calculates HF correctly for safe position", () => {
    const result = computeHealthFactor(safePosition);
    // HF = (10 * 3000 * 0.85) / 15000 = 1.7
    assert.ok(Math.abs(result.healthFactor - 1.7) < 0.01);
    assert.equal(result.riskLevel, "safe");
  });

  it("calculates HF correctly for danger position", () => {
    const result = computeHealthFactor(dangerPosition);
    // HF = (10 * 3000 * 0.85) / 24000 = 1.0625
    assert.ok(result.healthFactor < 1.2);
    assert.ok(result.healthFactor > 1.0);
  });

  it("returns Infinity for zero debt", () => {
    const result = computeHealthFactor({ ...safePosition, borrowAmount: 0 });
    assert.equal(result.healthFactor, Infinity);
    assert.equal(result.riskLevel, "safe");
  });

  it("calculates liquidation price correctly", () => {
    const result = computeHealthFactor(safePosition);
    // liq price = 15000 / (10 * 0.85) = 1764.71
    assert.ok(Math.abs(result.liquidationPriceCollateral - 1764.71) < 1);
  });

  it("calculates buffer percent", () => {
    const result = computeHealthFactor(safePosition);
    assert.ok(result.bufferPercent > 0);
    assert.ok(result.bufferPercent < 100);
  });
});

describe("classifyRisk", () => {
  it("classifies safe", () => assert.equal(classifyRisk(2.0, DEFAULT_ALERT_CONFIG), "safe"));
  it("classifies warning", () => assert.equal(classifyRisk(1.3, DEFAULT_ALERT_CONFIG), "warning"));
  it("classifies danger", () => assert.equal(classifyRisk(1.15, DEFAULT_ALERT_CONFIG), "danger"));
  it("classifies critical", () => assert.equal(classifyRisk(1.02, DEFAULT_ALERT_CONFIG), "critical"));
});

describe("simulatePriceDrop", () => {
  it("shows liquidation at 50% crash", () => {
    const result = simulatePriceDrop(safePosition, 50);
    assert.equal(result.wouldLiquidate, true);
    assert.equal(result.newCollateralPrice, 1500);
  });

  it("shows safe at 10% crash", () => {
    const result = simulatePriceDrop(safePosition, 10);
    assert.equal(result.wouldLiquidate, false);
    assert.equal(result.newCollateralPrice, 2700);
  });

  it("shows danger at 30% crash", () => {
    const result = simulatePriceDrop(safePosition, 30);
    assert.ok(result.newHealthFactor < 1.5);
  });

  it("shows critical at 40% crash", () => {
    const result = simulatePriceDrop(safePosition, 40);
    assert.ok(result.newHealthFactor < 1.2);
  });
});
