/**
 * Hop Protocol bridge provider.
 *
 * Hop is a rollup-to-rollup bridge using AMMs and hTokens.
 * API: https://docs.hop.exchange/
 *
 * In production, calls Hop API for real-time quotes.
 */

import type { BridgeProvider, BridgeRoute, ChainPair, RouteQuery } from "../types";

const HOP_ROUTES: Record<string, Omit<BridgeRoute, "outputAmount">[]> = {
  "ETH:ARB": [
    {
      provider: "Hop",
      type: "amm",
      estimatedTimeMin: 3,
      feeUsd: 0.3,
      riskLevel: "LOW",
      requirements: ["ETH for gas on destination"],
      liquidityUsd: 20_000_000,
    },
  ],
  "ETH:OP": [
    {
      provider: "Hop",
      type: "amm",
      estimatedTimeMin: 4,
      feeUsd: 0.3,
      riskLevel: "LOW",
      requirements: ["ETH for gas on destination"],
      liquidityUsd: 18_000_000,
    },
  ],
  "ETH:POLYGON": [
    {
      provider: "Hop",
      type: "amm",
      estimatedTimeMin: 5,
      feeUsd: 0.35,
      riskLevel: "MEDIUM",
      requirements: ["MATIC for gas on destination"],
      liquidityUsd: 10_000_000,
    },
  ],
  "ARB:OP": [
    {
      provider: "Hop",
      type: "amm",
      estimatedTimeMin: 4,
      feeUsd: 0.25,
      riskLevel: "LOW",
      requirements: ["ETH for gas on destination"],
      liquidityUsd: 15_000_000,
    },
  ],
  "ARB:POLYGON": [
    {
      provider: "Hop",
      type: "amm",
      estimatedTimeMin: 6,
      feeUsd: 0.3,
      riskLevel: "MEDIUM",
      requirements: ["MATIC for gas on destination"],
      liquidityUsd: 8_000_000,
    },
  ],
  "OP:POLYGON": [
    {
      provider: "Hop",
      type: "amm",
      estimatedTimeMin: 5,
      feeUsd: 0.35,
      riskLevel: "MEDIUM",
      requirements: ["MATIC for gas on destination"],
      liquidityUsd: 7_000_000,
    },
  ],
};

function pairKey(pair: ChainPair): string {
  return `${pair.from}:${pair.to}`;
}

export class HopProvider implements BridgeProvider {
  readonly name = "Hop";

  private isHealthy = true;

  async getRoutes(query: RouteQuery): Promise<BridgeRoute[]> {
    const key = pairKey({ from: query.fromChain, to: query.toChain });
    const reverseKey = pairKey({ from: query.toChain, to: query.fromChain });

    const templates = HOP_ROUTES[key] || HOP_ROUTES[reverseKey];
    if (!templates) return [];

    return templates
      .filter((r) => {
        const maxAmount = (r.liquidityUsd ?? 1e9) * 0.02;
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
    return Boolean(HOP_ROUTES[key] || HOP_ROUTES[reverseKey]);
  }

  async healthCheck(): Promise<boolean> {
    return this.isHealthy;
  }
}
