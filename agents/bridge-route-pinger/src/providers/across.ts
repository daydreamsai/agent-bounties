/**
 * Across Protocol bridge provider.
 *
 * Across is an optimistic cross-chain bridge using UMA's optimistic oracle.
 * API: https://docs.across.to/reference/api
 *
 * In production, calls Across API for real-time quotes.
 */

import type { BridgeProvider, BridgeRoute, ChainPair, RouteQuery } from "../types";

const ACROSS_ROUTES: Record<string, Omit<BridgeRoute, "outputAmount">[]> = {
  "ETH:ARB": [
    {
      provider: "Across",
      type: "liquidity_pool",
      estimatedTimeMin: 2,
      feeUsd: 0.5,
      riskLevel: "LOW",
      requirements: [],
      liquidityUsd: 50_000_000,
    },
  ],
  "ETH:BASE": [
    {
      provider: "Across",
      type: "liquidity_pool",
      estimatedTimeMin: 2,
      feeUsd: 0.4,
      riskLevel: "LOW",
      requirements: [],
      liquidityUsd: 45_000_000,
    },
  ],
  "ETH:OP": [
    {
      provider: "Across",
      type: "liquidity_pool",
      estimatedTimeMin: 3,
      feeUsd: 0.55,
      riskLevel: "LOW",
      requirements: [],
      liquidityUsd: 35_000_000,
    },
  ],
  "ETH:POLYGON": [
    {
      provider: "Across",
      type: "liquidity_pool",
      estimatedTimeMin: 4,
      feeUsd: 0.65,
      riskLevel: "LOW",
      requirements: [],
      liquidityUsd: 25_000_000,
    },
  ],
  "ARB:OP": [
    {
      provider: "Across",
      type: "liquidity_pool",
      estimatedTimeMin: 3,
      feeUsd: 0.35,
      riskLevel: "LOW",
      requirements: [],
      liquidityUsd: 20_000_000,
    },
  ],
  "ARB:BASE": [
    {
      provider: "Across",
      type: "liquidity_pool",
      estimatedTimeMin: 3,
      feeUsd: 0.4,
      riskLevel: "LOW",
      requirements: [],
      liquidityUsd: 15_000_000,
    },
  ],
  "BASE:OP": [
    {
      provider: "Across",
      type: "liquidity_pool",
      estimatedTimeMin: 3,
      feeUsd: 0.3,
      riskLevel: "LOW",
      requirements: [],
      liquidityUsd: 22_000_000,
    },
  ],
};

function pairKey(pair: ChainPair): string {
  return `${pair.from}:${pair.to}`;
}

export class AcrossProvider implements BridgeProvider {
  readonly name = "Across";

  private isHealthy = true;

  async getRoutes(query: RouteQuery): Promise<BridgeRoute[]> {
    const key = pairKey({ from: query.fromChain, to: query.toChain });
    const reverseKey = pairKey({ from: query.toChain, to: query.fromChain });

    const templates = ACROSS_ROUTES[key] || ACROSS_ROUTES[reverseKey];
    if (!templates) return [];

    return templates
      .filter((r) => {
        const maxAmount = (r.liquidityUsd ?? 1e9) * 0.05;
        return query.amount <= maxAmount;
      })
      .map((r) => ({
        ...r,
        outputAmount: parseFloat((query.amount - r.feeUsd).toFixed(6)),
      }));
  }

  isSupported(pair: ChainPair): boolean {
    const key = pairKey(pair);
    const reverseKey = pairKey({ from: pair.to, to: pair.from });
    return Boolean(ACROSS_ROUTES[key] || ACROSS_ROUTES[reverseKey]);
  }

  async healthCheck(): Promise<boolean> {
    return this.isHealthy;
  }
}
