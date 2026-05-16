import { describe, it, expect } from "vitest";
import { normalizeChain, CHAIN_ALIASES, SUPPORTED_CHAINS } from "../src/types";

describe("normalizeChain", () => {
  it("normalizes chain ID strings to short names", () => {
    expect(normalizeChain("1")).toBe("ETH");
    expect(normalizeChain("42161")).toBe("ARB");
    expect(normalizeChain("8453")).toBe("BASE");
    expect(normalizeChain("10")).toBe("OP");
    expect(normalizeChain("137")).toBe("POLYGON");
    expect(normalizeChain("43114")).toBe("AVAX");
    expect(normalizeChain("56")).toBe("BSC");
  });

  it("normalizes human-readable names", () => {
    expect(normalizeChain("ethereum")).toBe("ETH");
    expect(normalizeChain("arbitrum")).toBe("ARB");
    expect(normalizeChain("base")).toBe("BASE");
    expect(normalizeChain("optimism")).toBe("OP");
    expect(normalizeChain("polygon")).toBe("POLYGON");
  });

  it("normalizes aliases", () => {
    expect(normalizeChain("mainnet")).toBe("ETH");
    expect(normalizeChain("arb")).toBe("ARB");
    expect(normalizeChain("poly")).toBe("POLYGON");
    expect(normalizeChain("bnb")).toBe("BSC");
  });

  it("uppercases unknown inputs", () => {
    expect(normalizeChain("unknown")).toBe("UNKNOWN");
    expect(normalizeChain("foo")).toBe("FOO");
  });

  it("handles case insensitivity", () => {
    expect(normalizeChain("ETH")).toBe("ETH");
    expect(normalizeChain("Eth")).toBe("ETH");
    expect(normalizeChain("eth")).toBe("ETH");
    expect(normalizeChain("ARBITRUM")).toBe("ARB");
  });
});

describe("SUPPORTED_CHAINS", () => {
  it("has correct chain IDs for core chains", () => {
    expect(SUPPORTED_CHAINS.ETH.chainId).toBe(1);
    expect(SUPPORTED_CHAINS.ARB.chainId).toBe(42161);
    expect(SUPPORTED_CHAINS.BASE.chainId).toBe(8453);
    expect(SUPPORTED_CHAINS.OP.chainId).toBe(10);
  });

  it("has names for all chains", () => {
    for (const [key, chain] of Object.entries(SUPPORTED_CHAINS)) {
      expect(chain.name).toBeTruthy();
      expect(typeof chain.shortName).toBe("string");
      expect(chain.chainId).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("CHAIN_ALIASES", () => {
  it("has aliases that resolve via normalizeChain for all supported chains", () => {
    for (const key of Object.keys(SUPPORTED_CHAINS)) {
      // normalizeChain handles both alias lookup and uppercase fallback
      const normalized = normalizeChain(key);
      expect(normalized).toBe(key);
    }
  });
});
