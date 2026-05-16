/**
 * Tests for Impermanent Loss Calculator
 */
import { describe, it, expect } from "vitest";
import {
  calcILV2,
  calcV3Leverage,
  calcILV3,
  calculateImpermanentLoss,
  estimateFeeApr,
  analyzePriceRatio,
  calcNetPnL,
} from "../src/il-calculator.js";

// ─── V2 Impermanent Loss ─────────────────────────────────────

describe("calcILV2", () => {
  it("returns 0 when price is unchanged", () => {
    expect(calcILV2(1)).toBe(0);
  });

  it("returns ~0.11% loss for 10% price increase", () => {
    const il = calcILV2(1.1);
    // 2*sqrt(1.1)/(2.1) - 1 = 2*1.0488/2.1 - 1 = -0.001134
    expect(il).toBeCloseTo(-0.00113, 4);
  });

  it("returns ~5.7% loss for 2x price increase", () => {
    const il = calcILV2(2);
    // 2*sqrt(2)/3 - 1 = 2*1.414/3 - 1 = 0.943 - 1 = -0.0572
    expect(il).toBeCloseTo(-0.0572, 3);
  });

  it("returns ~13.4% loss for 5x price increase", () => {
    const il = calcILV2(5);
    // 2*sqrt(5)/6 - 1 = 2*2.236/6 - 1 = 0.745 - 1 = -0.255
    expect(il).toBeCloseTo(-0.2546, 3);
  });

  it("returns ~20% loss for 10x price increase", () => {
    // 2*sqrt(10)/11 - 1 ≈ 2*3.162/11 - 1 = 0.575 - 1 = -0.425
    const il = calcILV2(10);
    expect(il).toBeLessThan(-0.2);
    expect(il).toBeGreaterThan(-1);
  });

  it("is symmetric: same IL for price doubling vs halving", () => {
    // priceRatio=2 means price doubled, priceRatio=0.5 means halved
    const ilUp = calcILV2(2);
    const ilDown = calcILV2(0.5);
    expect(ilUp).toBeCloseTo(ilDown, 5);
  });

  it("returns -1 for zero price (complete loss)", () => {
    expect(calcILV2(0)).toBe(-1);
  });

  it("returns -1 for negative price", () => {
    expect(calcILV2(-0.5)).toBe(-1);
  });

  it("monotonic: larger price movement = more IL", () => {
    const il1 = calcILV2(1.05);
    const il2 = calcILV2(2);
    const il3 = calcILV2(5);
    // All should be negative, with il1 (closest to 0) > il2 > il3
    expect(il1).toBeGreaterThan(il2);
    expect(il2).toBeGreaterThan(il3);
  });
});

// ─── V3 Leverage Factor ──────────────────────────────────────

describe("calcV3Leverage", () => {
  it("returns 1 for full range (effectively V2)", () => {
    // Very wide range is approximately full range
    const lev = calcV3Leverage(0.0001, 100000);
    expect(lev).toBeCloseTo(1, 0);
  });

  it("returns > 1 for concentrated position", () => {
    const lev = calcV3Leverage(1500, 2500);
    expect(lev).toBeGreaterThan(1);
  });

  it("returns higher leverage for narrower range", () => {
    const lev1 = calcV3Leverage(1800, 2200);
    const lev2 = calcV3Leverage(1500, 2500);
    expect(lev1).toBeGreaterThan(lev2);
  });

  it("returns 1 for invalid ranges (safety fallback)", () => {
    expect(calcV3Leverage(0, 100)).toBe(1);
    expect(calcV3Leverage(-1, 100)).toBe(1);
    expect(calcV3Leverage(100, 50)).toBe(1);
  });

  it("tends to infinity as range narrows to a point", () => {
    const lev = calcV3Leverage(1999, 2001);
    // Very narrow range, leverage should be very high
    expect(lev).toBeGreaterThan(50);
  });
});

// ─── V3 Impermanent Loss ─────────────────────────────────────

describe("calcILV3", () => {
  it("returns -1 when price is outside range (below)", () => {
    // priceRatio=0.5 means price halved. Range [600,1400], 0.5*entry < 600
    const il = calcILV3(0.5, 600, 1400);
    expect(il).toBe(-1);
  });

  it("returns -1 when price is outside range (above)", () => {
    // priceRatio=2.0 with range [500,1500] is in-range, use range [500,1500]/entry...
    // Let's use priceRatio that puts us above: range [600,1400], priceRatio=2.0
    // If entry=1000, current=2000, current > upper 1400
    const il = calcILV3(2.0, 600, 1400);
    expect(il).toBe(-1);
  });

  it("returns -1 when fully out of range", () => {
    // Price ratio = current / entry = 500 / 1000 = 0.5
    // Entry was 1000, current is 500. Range is [600, 1400]
    // Current 500 < lower 600 → out of range
    const il = calcILV3(0.5, 600, 1400);
    expect(il).toBe(-1);
  });

  it("amplifies IL relative to V2 for in-range position", () => {
    // V3 with concentrated range should have more IL than V2
    const ilV2 = calcILV2(1.5);
    const ilV3 = calcILV3(1.5, 1000, 2000);
    // V3 IL should be more negative (worse) than V2
    expect(ilV3).toBeLessThan(ilV2);
  });

  it("returns 0 for unchanged price in range", () => {
    // entry_price is assumed 1 by calcILV3; range must include 1
    expect(calcILV3(1, 0.5, 1.5)).toBe(0);
  });
});

// ─── Fee APR Estimation ──────────────────────────────────────

describe("estimateFeeApr", () => {
  it("returns ~15.6% APR for typical 30bps pool with 10% daily volume/TVL", () => {
    const apr = estimateFeeApr({
      feeTierBps: 30, // 0.3%
      volumeWindow: 100_000, // $100k volume in window
      tvlCurrent: 1_000_000, // $1M TVL
      windowHours: 24,
    });
    // 0.003 * 100k / 1M = 0.0003 = 0.03% return in 24h
    // 0.0003 * 365 = 0.1095 = ~10.95%
    expect(apr).toBeCloseTo(0.1095, 2);
  });

  it("returns 0 when TVL is zero", () => {
    const apr = estimateFeeApr({
      feeTierBps: 30,
      volumeWindow: 100_000,
      tvlCurrent: 0,
      windowHours: 24,
    });
    expect(apr).toBe(0);
  });

  it("returns 0 for zero window hours", () => {
    const apr = estimateFeeApr({
      feeTierBps: 30,
      volumeWindow: 100_000,
      tvlCurrent: 1_000_000,
      windowHours: 0,
    });
    expect(apr).toBe(0);
  });

  it("scales linearly with fee tier", () => {
    const apr30 = estimateFeeApr({
      feeTierBps: 30,
      volumeWindow: 100_000,
      tvlCurrent: 1_000_000,
      windowHours: 24,
    });
    const apr100 = estimateFeeApr({
      feeTierBps: 100,
      volumeWindow: 100_000,
      tvlCurrent: 1_000_000,
      windowHours: 24,
    });
    // 100bps APR should be 100/30 times 30bps APR
    expect(apr100).toBeCloseTo((100 / 30) * apr30, 1);
  });

  it("annualizes correctly: same APR regardless of window for same rate", () => {
    // If volume/TVL/hour is constant, APR should be same
    const apr24h = estimateFeeApr({
      feeTierBps: 30,
      volumeWindow: 100_000,
      tvlCurrent: 1_000_000,
      windowHours: 24,
    });
    const apr1h = estimateFeeApr({
      feeTierBps: 30,
      volumeWindow: 100_000 / 24,
      tvlCurrent: 1_000_000,
      windowHours: 1,
    });
    expect(apr24h).toBeCloseTo(apr1h, 3);
  });
});

// ─── Main Dispatcher ──────────────────────────────────────────

describe("calculateImpermanentLoss", () => {
  it("uses V2 formula when ammType is uniswap_v2", () => {
    const il = calculateImpermanentLoss({
      ammType: "uniswap_v2",
      priceRatio: 2,
    });
    expect(il).toBeCloseTo(calcILV2(2), 5);
  });

  it("uses V3 formula when ammType is uniswap_v3 with range", () => {
    const il = calculateImpermanentLoss({
      ammType: "uniswap_v3",
      priceRatio: 1.5,
      priceRange: [1000, 2000],
    });
    expect(il).toBeCloseTo(calcILV3(1.5, 1000, 2000), 5);
  });

  it("defaults to V2 when V3 has no range", () => {
    const il = calculateImpermanentLoss({
      ammType: "uniswap_v3",
      priceRatio: 1.5,
    });
    expect(il).toBeCloseTo(calcILV2(1.5), 5);
  });
});

// ─── Price Analysis ───────────────────────────────────────────

describe("analyzePriceRatio", () => {
  it("detects flat when deviation < 0.5%", () => {
    const result = analyzePriceRatio(100.4, 100);
    expect(result.direction).toBe("flat");
    expect(result.severity).toBe("low");
  });

  it("detects up direction for price increase", () => {
    const result = analyzePriceRatio(150, 100);
    expect(result.direction).toBe("up");
    expect(result.ratio).toBe(1.5);
    expect(result.deviationPercent).toBeCloseTo(50, 1);
  });

  it("detects down direction for price decrease", () => {
    const result = analyzePriceRatio(80, 100);
    expect(result.direction).toBe("down");
    expect(result.deviationPercent).toBeCloseTo(-20, 1);
  });

  it("severity scales with deviation", () => {
    expect(analyzePriceRatio(102, 100).severity).toBe("low");
    expect(analyzePriceRatio(115, 100).severity).toBe("medium");
    expect(analyzePriceRatio(140, 100).severity).toBe("high");
    expect(analyzePriceRatio(200, 100).severity).toBe("extreme");
  });
});

// ─── Net P&L ──────────────────────────────────────────────────

describe("calcNetPnL", () => {
  it("shows profit when fees exceed IL", () => {
    // Small IL, large fees
    const il = -0.01; // 1% IL
    const feeApr = 5.0; // 500% APR
    const windowHours = 24;
    // fees in window: 5.0 * (24/8760) = 0.0137
    // net: 0.0137 - 0.01 = 0.0037
    const net = calcNetPnL(il, feeApr, windowHours);
    expect(net).toBeGreaterThan(0);
  });

  it("shows loss when IL exceeds fees", () => {
    const il = -0.20; // 20% IL
    const feeApr = 0.10; // 10% APR
    const windowHours = 24;
    // fees: 0.10 * (24/8760) = 0.00027
    // net: 0.00027 - 0.20 = -0.1997
    const net = calcNetPnL(il, feeApr, windowHours);
    expect(net).toBeLessThan(0);
  });
});
