import { describe, it, expect } from "vitest";
import {
  calculateILV2,
  calculateILV3,
  calculateWeightedIL,
  estimateFeeAPR,
  calculateBreakEvenPriceRatio,
  analyzeTokens,
  generateNotes,
  estimateImpermanentLoss,
} from "../src/agent";

describe("calculateILV2", () => {
  it("returns 0 when price ratio is 1 (no IL)", () => {
    expect(calculateILV2(1)).toBeCloseTo(0, 10);
  });

  it("calculates IL correctly for 2x price increase", () => {
    // IL = 2 * sqrt(2) / (1 + 2) - 1 = 2 * 1.414 / 3 - 1 ≈ -0.0572
    const il = calculateILV2(2);
    expect(il).toBeCloseTo(-0.0572, 3);
  });

  it("calculates IL correctly for 0.5x price drop", () => {
    // IL for 0.5x is same as for 2x due to symmetry
    const il = calculateILV2(0.5);
    expect(il).toBeCloseTo(-0.0572, 3);
  });

  it("calculates known IL for 4x price increase", () => {
    // IL = 2 * sqrt(4) / (1 + 4) - 1 = 4/5 - 1 = -0.2
    expect(calculateILV2(4)).toBeCloseTo(-0.2, 5);
  });

  it("throws on non-positive price ratio", () => {
    expect(() => calculateILV2(0)).toThrow();
    expect(() => calculateILV2(-1)).toThrow();
  });
});

describe("calculateILV3", () => {
  it("returns 0 for in-range price at entry with symmetric ticks", () => {
    expect(calculateILV3(1, 0.8, 1.2)).toBeCloseTo(0, 3);
  });

  it("calculates IL for price below range", () => {
    const il = calculateILV3(0.5, 0.8, 1.2);
    // Below lower tick: price_ratio / tick_lower - 1 = 0.5/0.8 - 1 = -0.375
    expect(il).toBeLessThan(0);
  });

  it("calculates IL for price above range", () => {
    const il = calculateILV3(1.5, 0.8, 1.2);
    // Above upper tick: tick_upper / price_ratio - 1 = 1.2/1.5 - 1 = -0.2
    expect(il).toBeLessThan(0);
  });

  it("throws on invalid parameters", () => {
    expect(() => calculateILV3(1, 2, 1)).toThrow();
    expect(() => calculateILV3(1, -1, 1)).toThrow();
  });
});

describe("calculateWeightedIL", () => {
  it("handles equal weight two-token pool", () => {
    const il = calculateWeightedIL([2, 0.5], [0.5, 0.5]);
    // IL for r=2 and r=0.5 are both -0.0572, so weighted = -0.0572
    expect(il).toBeCloseTo(-0.0572, 3);
  });

  it("throws on mismatched arrays", () => {
    expect(() => calculateWeightedIL([1, 2], [0.5])).toThrow();
  });
});

describe("estimateFeeAPR", () => {
  it("calculates fee APR from volume", () => {
    const apr = estimateFeeAPR(1_000_000, 0, 10_000_000, "uniswap_v2");
    // daily fees = 1M * 0.003 = 3000, annual = 3000 * 365 = 1,095,000
    // APR = 1,095,000 / 10,000,000 * 100 = 10.95%
    expect(apr).toBeCloseTo(10.95, 1);
  });

  it("returns 0 for zero TVL", () => {
    expect(estimateFeeAPR(1_000_000, 0, 0, "uniswap_v2")).toBe(0);
  });

  it("uses actual fees when provided", () => {
    const apr = estimateFeeAPR(1_000_000, 5000, 10_000_000, "uniswap_v2");
    // daily fees = 5000, annual = 5000 * 365 = 1,825,000
    // APR = 1,825,000 / 10,000,000 * 100 = 18.25%
    expect(apr).toBeCloseTo(18.25, 1);
  });
});

describe("calculateBreakEvenPriceRatio", () => {
  it("returns symmetric bounds around 1 for moderate fee APR", () => {
    const result = calculateBreakEvenPriceRatio(10, 1);
    expect(result.lower).toBeLessThan(1);
    expect(result.upper).toBeGreaterThan(1);
  });

  it("returns wider bounds for higher fee APR", () => {
    const lowFee = calculateBreakEvenPriceRatio(5, 1);
    const highFee = calculateBreakEvenPriceRatio(30, 1);
    expect(highFee.upper).toBeGreaterThan(lowFee.upper);
    expect(highFee.lower).toBeLessThan(lowFee.lower);
  });
});

describe("analyzeTokens", () => {
  it("calculates PnL for each token", () => {
    const analyses = analyzeTokens([1000, 1000], [0.5, 0.5], [2, 0.5]);
    expect(analyses).toHaveLength(2);
    expect(analyses[0].pnl_usd).toBe(1000);  // 1000 * 2 - 1000
    expect(analyses[1].pnl_usd).toBe(-500);  // 1000 * 0.5 - 1000
  });
});

describe("generateNotes", () => {
  it("warns on severe IL", () => {
    const notes = generateNotes(-25, 5, 1_000_000, 1);
    expect(notes.some((n) => n.includes("Severe"))).toBe(true);
  });

  it("notes high fee APR", () => {
    const notes = generateNotes(-1, 60, 1_000_000, 1);
    expect(notes.some((n) => n.includes("HIGH FEE"))).toBe(true);
  });

  it("notes profitable position", () => {
    const notes = generateNotes(-2, 300, 1_000_000, 1);
    expect(notes.some((n) => n.includes("profitable"))).toBe(true);
  });
});

describe("estimateImpermanentLoss", () => {
  it("returns complete output for V2 pool", async () => {
    const result = await estimateImpermanentLoss({
      pool_address: "0x1234...",
      token_weights: [0.5, 0.5],
      deposit_amounts: [1000, 1000],
      window_hours: 24,
      pool_type: "uniswap_v2",
      entry_price_ratio: 1.0,
      current_price_ratio: 1.5,
    });

    expect(result.IL_percent).toBeDefined();
    expect(result.IL_usd).toBeDefined();
    expect(result.fee_apr_est).toBeGreaterThan(0);
    expect(result.volume_window).toBeGreaterThan(0);
    expect(result.token_analyses).toHaveLength(2);
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.break_even_price_ratio).toBeGreaterThan(0);
  });

  it("handles default values", async () => {
    const result = await estimateImpermanentLoss({
      pool_address: "0x5678...",
      token_weights: [1.0],
      deposit_amounts: [500],
      window_hours: 24,
    });

    expect(result.pool_type).toBe("uniswap_v2");
    expect(result.IL_percent).toBeCloseTo(0, 1);
  });

  it("handles V3 pool type", async () => {
    const result = await estimateImpermanentLoss({
      pool_address: "0xabcd...",
      token_weights: [0.5, 0.5],
      deposit_amounts: [1000, 1000],
      window_hours: 24,
      pool_type: "uniswap_v3",
    });

    expect(result.pool_type).toBe("uniswap_v3");
  });
});
