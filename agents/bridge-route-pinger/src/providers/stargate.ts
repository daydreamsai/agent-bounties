/**
 * Stargate V2 bridge provider.
 *
 * Stargate is an omnichain liquidity layer built on LayerZero.
 * API: https://stargateprotocol.gitbook.io/stargate
 *
 * In production, this would call the Stargate API to fetch real quotes.
 * For now, it uses structured simulated data mirroring Stargate's routes.
 */

import type { BridgeProvider, BridgeRoute, ChainPair, RouteQuery } from "../types";

const STARGATE_ROUTES: Record<string, Omit<BridgeRoute, "outputAmount">[]> = {
  "ETH:ARB": [
    {
      provider: "Stargate V2",
      type: "liquidity_pool",
      estimatedTimeMin: 3,
      feeUsd: 0.6,
      riskLevel: "LOW",
      requirements: ["ETH for gas"],
      liquidityUsd: 25_000_000,
    },
    {
      provider: "Stargate V2",
      type: "liquidity_pool",
      estimatedTimeMin: 2,
      feeUsd: 0.9,
      riskLevel: "LOW",
      requirements: ["ETH for gas"],
      liquidityUsd: 40_000_000,
    },
  ],
  "ETH:BASE": [
    {
      provider: "Stargate V2",
      type: "liquidity_pool",
      estimatedTimeMin: 3,
      feeUsd: 0.5,
      riskLevel: "LOW",
      requirements: ["ETH for gas"],
      liquidityUsd: 30_000_000,
    },
  ],
  "ETH:OP": [
    {
      provider: "Stargate V2",
      type: "liquidity_pool",
      estimatedTimeMin: 3,
      feeUsd: 0.55,
      riskLevel: "LOW",
      requirements: ["ETH for gas"],
      liquidityUsd: 20_000_000,
    },
  ],
  "ETH:POLYGON": [
    {
      provider: "Stargate V2",
      type: "liquidity_pool",
      estimatedTimeMin: 4,
      feeUsd: 0.7,
      riskLevel: "LOW",
      requirements: ["MATIC for gas"],
      liquidityUsd: 15_000_000,
    },
  ],
  "ETH:AVAX": [
    {
      provider: "Stargate V2",
      type: "liquidity_pool",
      estimatedTimeMin: 3,
      feeUsd: 0.65,
      riskLevel: "LOW",
      requirements: ["AVAX for gas"],
      liquidityUsd: 18_000_000,
    },
  ],
  "ETH:BSC": [
    {
      provider: "Stargate V2",
      type: "liquidity_pool",
      estimatedTimeMin: 5,
      feeUsd: 0.75,
      riskLevel: "LOW",
      requirements: ["BNB for gas"],
      liquidityUsd: 12_000_000,
    },
  ],
  "ARB:OP": [
    {
      provider: "Stargate V2",
      type: "liquidity_pool",
      estimatedTimeMin: 4,
      feeUsd: 0.45,
      riskLevel: "LOW",
      requirements: ["ETH for gas"],
      liquidityUsd: 10_000_000,
    },
  ],
};

function pairKey(pair: ChainPair): string {
  return `${pair.from}:${pair.to}`;
}

export class StargateProvider implements BridgeProvider {
  readonly name = "Stargate V2";

  private isHealthy = true;

  async getRoutes(query: RouteQuery): Promise<BridgeRoute[]> {
    const key = pairKey({ from: query.fromChain, to: query.toChain });
    const reverseKey = pairKey({ from: query.toChain, to: query.fromChain });

    const templates = STARGATE_ROUTES[key] || STARGATE_ROUTES[reverseKey];
    if (!templates) return [];

    return templates
      .filter((r) => {
        const maxAmount = (r.liquidityUsd ?? 1e9) * 0.01;
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
    return Boolean(STARGATE_ROUTES[key] || STARGATE_ROUTES[reverseKey]);
  }

  async healthCheck(): Promise<boolean> {
    // In production: ping the Stargate API /status endpoint
    return this.isHealthy;
  }
}
