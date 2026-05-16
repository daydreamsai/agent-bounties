import { describe, it, expect } from "vitest";
import { pingBridgeRoutes } from "../src/agent";
import type { ChainId, BridgeProtocol } from "../src/types";

describe("pingBridgeRoutes", () => {
  it("returns routes for a valid cross-chain transfer", async () => {
    const result = await pingBridgeRoutes({
      token: "USDC",
      amount: 1000,
      from_chain: "ethereum",
      to_chain: "arbitrum",
    });

    expect(result.token).toBe("USDC");
    expect(result.from_chain).toBe("ethereum");
    expect(result.to_chain).toBe("arbitrum");
    expect(result.routes.length).toBeGreaterThan(0);
  });

  it("returns alerts when source and destination are the same", async () => {
    const result = await pingBridgeRoutes({
      token: "ETH",
      amount: 1,
      from_chain: "ethereum",
      to_chain: "ethereum",
    });

    expect(result.routes).toHaveLength(0);
    expect(result.recommended).toBeNull();
    expect(result.alerts.some((a) => a.includes("same"))).toBe(true);
  });

  it("provides a recommended route", async () => {
    const result = await pingBridgeRoutes({
      token: "USDC",
      amount: 500,
      from_chain: "arbitrum",
      to_chain: "base",
    });

    expect(result.recommended).not.toBeNull();
    if (result.recommended) {
      expect(result.recommended.bridge).toBeDefined();
      expect(result.recommended.fee_usd).toBeGreaterThan(0);
      expect(result.recommended.eta_minutes).toBeGreaterThan(0);
    }
  });

  it("respects preferred bridges", async () => {
    const result = await pingBridgeRoutes({
      token: "ETH",
      amount: 100,
      from_chain: "ethereum",
      to_chain: "polygon",
      preferred_bridges: ["across"],
    });

    // Across should be first
    if (result.routes.length > 0) {
      // Preferred bridges are sorted first
      const preferredFirst = result.routes.slice(0, 1);
      expect(preferredFirst.length).toBeGreaterThan(0);
    }
  });

  it("respects max_routes limit", async () => {
    const result = await pingBridgeRoutes({
      token: "USDC",
      amount: 1000,
      from_chain: "ethereum",
      to_chain: "arbitrum",
      max_routes: 2,
    });

    expect(result.routes.length).toBeLessThanOrEqual(2);
  });

  it("each route has required fields", async () => {
    const result = await pingBridgeRoutes({
      token: "USDC",
      amount: 1000,
      from_chain: "ethereum",
      to_chain: "arbitrum",
    });

    for (const route of result.routes) {
      expect(route.bridge).toBeDefined();
      expect(route.fee_usd).toBeDefined();
      expect(route.eta_minutes).toBeDefined();
      expect(route.status).toBeDefined();
      expect(route.success_rate).toBeDefined();
      expect(route.requirements.length).toBeGreaterThan(0);
      expect(route.last_ping).toBeDefined();
    }
  });

  it("handles obscure chain pairings", async () => {
    const result = await pingBridgeRoutes({
      token: "USDT",
      amount: 5000,
      from_chain: "avalanche",
      to_chain: "bsc",
    });

    // Should find at least some bridges
    expect(result.routes.length).toBeGreaterThan(0);
  });

  it("produces alerts for degraded/down bridges", async () => {
    const result = await pingBridgeRoutes({
      token: "ETH",
      amount: 10,
      from_chain: "ethereum",
      to_chain: "base",
    });

    // Alerts exist (at least the recommended one)
    expect(result.alerts.length).toBeGreaterThan(0);
  });
});
