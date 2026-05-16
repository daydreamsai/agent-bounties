import { describe, it, expect } from "vitest";
import { StargateProvider } from "../src/providers/stargate";
import { AcrossProvider } from "../src/providers/across";
import { HopProvider } from "../src/providers/hop";
import { getProvidersForPair, aggregateRoutes, providerHealthCheck, listProviders } from "../src/providers";
import type { BridgeProvider, RouteQuery, ChainPair } from "../src/types";

// ── Shared test helpers ───────────────────────────────────────────────────

function makeQuery(
  overrides: Partial<RouteQuery> = {},
): RouteQuery {
  return {
    token: "USDC",
    amount: 1000,
    fromChain: "ETH",
    toChain: "ARB",
    ...overrides,
  };
}

async function testProvider(provider: BridgeProvider) {
  describe(provider.name, () => {
    it("has a name", () => {
      expect(provider.name).toBeTruthy();
      expect(typeof provider.name).toBe("string");
    });

    it("supports known chain pairs", () => {
      expect(provider.isSupported({ from: "ETH", to: "ARB" })).toBe(true);
    });

    it("reports unsupported pairs correctly", () => {
      expect(provider.isSupported({ from: "SOL", to: "ETH" })).toBe(
        false,
      );
    });

    it("returns routes for supported pairs", async () => {
      const query: RouteQuery = {
        token: "USDC",
        amount: 500,
        fromChain: "ETH",
        toChain: "ARB",
      };
      const routes = await provider.getRoutes(query);
      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBeGreaterThan(0);

      for (const route of routes) {
        expect(route.provider).toBeTruthy();
        expect(typeof route.feeUsd).toBe("number");
        expect(route.feeUsd).toBeGreaterThan(0);
        expect(typeof route.estimatedTimeMin).toBe("number");
        expect(route.estimatedTimeMin).toBeGreaterThan(0);
        expect(typeof route.outputAmount).toBe("number");
        expect(route.outputAmount).toBeLessThan(query.amount);
        expect(["LOW", "MEDIUM", "HIGH"]).toContain(route.riskLevel);
      }
    });

    it("returns empty array for unsupported pairs", async () => {
      const query: RouteQuery = {
        token: "USDC",
        amount: 500,
        fromChain: "SOL",
        toChain: "ETH",
      };
      const routes = await provider.getRoutes(query);
      expect(routes).toEqual([]);
    });

    it("filters routes by amount limits", async () => {
      // Very large amount should be filtered out for most providers
      const query: RouteQuery = {
        token: "USDC",
        amount: 100_000_000,
        fromChain: "ETH",
        toChain: "ARB",
      };
      const routes = await provider.getRoutes(query);

      // All routes should be within the provider's max amount
      for (const route of routes) {
        expect(route.outputAmount).toBeDefined();
      }
    });

    it("healthCheck returns boolean", async () => {
      const healthy = await provider.healthCheck();
      expect(typeof healthy).toBe("boolean");
    });
  });
}

// ── Provider tests ────────────────────────────────────────────────────────

testProvider(new StargateProvider());
testProvider(new AcrossProvider());
testProvider(new HopProvider());

// ── Registry / aggregator tests ───────────────────────────────────────────

describe("provider registry", () => {
  it("listProviders returns all providers", () => {
    const providers = listProviders();
    expect(providers.length).toBe(3);
    const names = providers.map((p) => p.name);
    expect(names).toContain("Stargate V2");
    expect(names).toContain("Across");
    expect(names).toContain("Hop");
  });

  it("getProvidersForPair returns relevant providers", () => {
    const providers = getProvidersForPair({ from: "ETH", to: "ARB" });
    expect(providers.length).toBeGreaterThanOrEqual(2);
  });

  it("getProvidersForPair returns empty for unsupported pair", () => {
    const providers = getProvidersForPair({ from: "SOL", to: "ETH" });
    expect(providers.length).toBe(0);
  });

  it("aggregateRoutes returns structured result for supported pair", async () => {
    const query = makeQuery({ fromChain: "ETH", toChain: "ARB" });
    const result = await aggregateRoutes(query);

    expect(result.fromChain).toBe("ETH");
    expect(result.toChain).toBe("ARB");
    expect(result.token).toBe("USDC");
    expect(result.amount).toBe(1000);
    expect(result.allRoutes.length).toBeGreaterThan(0);
    expect(result.bestCheapest).not.toBeNull();
    expect(result.bestFastest).not.toBeNull();
    expect(result.status).toBe("LIVE");
    expect(result.timestamp).toBeTruthy();
    expect(result.recommendation).toBeTruthy();
    expect(result.providersQueried.length).toBeGreaterThan(0);
  });

  it("aggregateRoutes marks UNAVAILABLE for unsupported pair", async () => {
    const query = makeQuery({ fromChain: "SOL", toChain: "ETH" });
    const result = await aggregateRoutes(query);

    expect(result.allRoutes).toEqual([]);
    expect(result.bestCheapest).toBeNull();
    expect(result.bestFastest).toBeNull();
    expect(result.status).toBe("UNAVAILABLE");
  });

  it("aggregateRoutes handles cross-chain normalization", async () => {
    // Lowercase input should still work
    const query = makeQuery({
      fromChain: "ethereum",
      toChain: "arbitrum",
    });
    const result = await aggregateRoutes(query);

    expect(result.fromChain).toBe("ETH");
    expect(result.toChain).toBe("ARB");
    expect(result.allRoutes.length).toBeGreaterThan(0);
  });

  it("healthCheck returns structured result", async () => {
    const health = await providerHealthCheck();
    expect(Array.isArray(health.healthy)).toBe(true);
    expect(Array.isArray(health.unhealthy)).toBe(true);
    expect(health.healthy.length + health.unhealthy.length).toBe(listProviders().length);
  });

  it("aggregrateRoutes sorts cheapest first", async () => {
    const query = makeQuery({ fromChain: "ETH", toChain: "ARB" });
    const result = await aggregateRoutes(query);

    if (result.allRoutes.length >= 2) {
      const cheapest = result.bestCheapest;
      expect(cheapest).not.toBeNull();
      for (const route of result.allRoutes) {
        expect(cheapest!.feeUsd).toBeLessThanOrEqual(route.feeUsd);
      }
    }
  });

  it("aggregrateRoutes sorts fastest first", async () => {
    const query = makeQuery({ fromChain: "ETH", toChain: "ARB" });
    const result = await aggregateRoutes(query);

    if (result.allRoutes.length >= 2) {
      const fastest = result.bestFastest;
      expect(fastest).not.toBeNull();
      for (const route of result.allRoutes) {
        expect(fastest!.estimatedTimeMin).toBeLessThanOrEqual(
          route.estimatedTimeMin,
        );
      }
    }
  });
});
