import { fetchLifiQuote } from './lifi.js';
import type { BridgeRoute } from './types.js';
import { bridgeInputSchema, type BridgeOutput } from './types.js';

export async function runBridgeRoutePinger(rawInput: unknown): Promise<BridgeOutput> {
  const input = bridgeInputSchema.parse(rawInput ?? {});
  const warnings: string[] = [];
  let routes: BridgeRoute[] = [];
  try {
    routes = [await fetchLifiQuote(input)];
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }
  return {
    routes,
    best_route: routes[0] ?? null,
    warnings,
    data_sources: ['lifi:v1:quote'],
    fetched_at: new Date().toISOString()
  };
}
