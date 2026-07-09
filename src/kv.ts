import type { NewPair } from "./types";

const DEFAULT_TTL = 600; // 10 minutes

function pairKey(chain: string, pairAddress: string): string {
  return `pair:${chain}:${pairAddress}`;
}

export async function writePair(
  kv: { put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void> },
  chain: string,
  pair: NewPair,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  const key = pairKey(chain, pair.pair_address);
  const value = JSON.stringify(pair);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await kv.put(key, value, { expirationTtl: ttl });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 100 : 500));
    }
  }
}

export async function readPair(
  kv: { get: (key: string) => Promise<string | null> },
  chain: string,
  pairAddress: string
): Promise<NewPair | null> {
  const key = pairKey(chain, pairAddress);
  const value = await kv.get(key);
  return value ? JSON.parse(value) : null;
}

export async function hasPair(
  kv: { get: (key: string) => Promise<string | null> },
  chain: string,
  pairAddress: string
): Promise<boolean> {
  const key = pairKey(chain, pairAddress);
  const value = await kv.get(key);
  return value !== null;
}

export async function listPairsByChain(
  kv: {
    list: (options?: { prefix?: string }) => Promise<{ keys: Array<{ name: string }>; list_complete: boolean; cursor: string }>;
    get: (key: string) => Promise<string | null>;
  },
  chain: string,
  windowMinutes: number = 10,
  now: Date = new Date()
): Promise<NewPair[]> {
  const prefix = `pair:${chain}:`;
  const { keys } = await kv.list({ prefix });

  const cutoff = new Date(now.getTime() - windowMinutes * 60 * 1000);
  const pairs: NewPair[] = [];

  for (const { name } of keys) {
    const value = await kv.get(name);
    if (!value) continue;

    const pair: NewPair = JSON.parse(value);
    const createdAt = new Date(pair.created_at);

    if (createdAt >= cutoff) {
      pairs.push(pair);
    }
  }

  return pairs;
}
