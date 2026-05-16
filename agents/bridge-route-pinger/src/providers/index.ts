/**
 * Bridge provider registry.
 *
 * Manages all bridge providers and aggregates routes across them.
 */

import type { BridgeProvider, BridgeRoute, ChainPair, RouteQuery, RouteResult } from "../types";
import { normalizeChain } from "../types";
import { StargateProvider } from "./stargate";
import { AcrossProvider } from "./across";
import { HopProvider } from "./hop";

/** All available bridge providers */
const PROVIDERS: BridgeProvider[] = [
  new StargateProvider(),
  new AcrossProvider(),
  new HopProvider(),
];

/** Get available providers that support a chain pair */
export function getProvidersForPair(pair: ChainPair): BridgeProvider[] {
  return PROVIDERS.filter((p) => p.isSupported(pair));
}

/** Aggregate routes from all providers for a route query */
export async function aggregateRoutes(query: RouteQuery): Promise<RouteResult> {
  const from = normalizeChain(query.fromChain);
  const to = normalizeChain(query.toChain);
  const pair: ChainPair = { from, to };

  const providers = getProvidersForPair(pair);
  const routesByProvider = await Promise.all(
    providers.map(async (p) => {
      try {
        const routes = await p.getRoutes({ ...query, fromChain: from, toChain: to });
        return { provider: p.name, routes };
      } catch {
        return { provider: p.name, routes: [] };
      }
    }),
  );

  const allRoutes: BridgeRoute[] = routesByProvider.flatMap((r) => r.routes);
  const providersQueried = providers.map((p) => p.name);

  // Sort for best results
  const sortedByFee = [...allRoutes].sort((a, b) => a.feeUsd - b.feeUsd);
  const sortedByTime = [...allRoutes].sort((a, b) => a.estimatedTimeMin - b.estimatedTimeMin);

  const bestCheapest = sortedByFee[0] || null;
  const bestFastest = sortedByTime[0] || null;

  let recommendation = "No routes available.";
  if (bestCheapest && bestFastest) {
    if (bestCheapest.provider === bestFastest.provider) {
      recommendation = `Use ${bestFastest.provider} — it offers both the fastest (${bestFastest.estimatedTimeMin}min) and cheapest ($${bestFastest.feeUsd}) route.`;
    } else {
      recommendation = `Use ${bestFastest.provider} for speed (${bestFastest.estimatedTimeMin}min) or ${bestCheapest.provider} to save on fees ($${bestCheapest.feeUsd}).`;
    }
  }

  return {
    query: `${query.amount} ${query.token} from ${from} to ${to}`,
    fromChain: from,
    toChain: to,
    token: query.token,
    amount: query.amount,
    allRoutes,
    bestCheapest,
    bestFastest,
    recommendation,
    status: allRoutes.length > 0 ? "LIVE" : "UNAVAILABLE",
    providersQueried,
    timestamp: new Date().toISOString(),
  };
}

/** Health check across all providers — returns unhealthy providers */
export async function providerHealthCheck(): Promise<{ healthy: string[]; unhealthy: string[] }> {
  const results = await Promise.all(
    PROVIDERS.map(async (p) => {
      try {
        const healthy = await p.healthCheck();
        return { name: p.name, healthy };
      } catch {
        return { name: p.name, healthy: false };
      }
    }),
  );

  return {
    healthy: results.filter((r) => r.healthy).map((r) => r.name),
    unhealthy: results.filter((r) => !r.healthy).map((r) => r.name),
  };
}

/** All registered providers (for external inspection) */
export function listProviders(): BridgeProvider[] {
  return [...PROVIDERS];
}
