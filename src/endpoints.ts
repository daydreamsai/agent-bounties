import { listPairsByChain } from "./kv";
import { getChainConfig } from "./chains";
import type { NewPair } from "./types";

export interface WorkerState {
  lastWebhook: string;
  lastCron: string;
}

export async function handleHealth(kv: any, state: WorkerState) {
  const { keys } = await kv.list();
  
  return {
    status: "ok",
    last_webhook: state.lastWebhook,
    last_cron: state.lastCron,
    pairs_cached: keys.length,
  };
}

export async function handleScan(
  input: { chain: string; factories?: string[]; window_minutes?: number },
  kv: any,
  now: Date = new Date()
) {
  const { chain, factories, window_minutes = 10 } = input;
  const config = getChainConfig(chain);
  
  const pairs = await listPairsByChain(kv, chain, window_minutes, now);
  
  const filtered = factories
    ? pairs.filter((p) => {
        const pairLower = p.pair_address.toLowerCase();
        return factories.some((f) => f.toLowerCase() === pairLower);
      })
    : pairs;

  const blocksPerMinute = config.blocksPerMinute;
  const to_block = 0;
  const from_block = to_block - window_minutes * blocksPerMinute;

  return {
    chain,
    window_minutes,
    from_block,
    to_block,
    new_pairs: filtered,
    total_found: filtered.length,
  };
}

export function withX402(handler: (req: Request) => Promise<any>) {
  return async (req: Request) => {
    const payment = req.headers.get("x402-payment");
    if (!payment) {
      const url = new URL(req.url);
      return {
        x402Version: 2,
        error: "Payment required",
        method: req.method,
        path: url.pathname,
        resource: req.url,
        network: "eip155:8453",
        asset: "USDC",
        amount: "0.01",
        payTo: "0x0000000000000000000000000000000000000000",
        facilitator: "https://api.cdp.coinbase.com/platform/v2/x402",
      };
    }
    return handler(req);
  };
}
