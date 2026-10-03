import {
  ChainName,
  DEFAULT_KV_TTL_SECONDS,
  KVStore,
  NewPair,
} from "./types";

export interface KVNamespaceLike {
  put(
    key: string,
    value: string,
    options?: {
      expirationTtl?: number;
    }
  ): Promise<void>;

  get<T = unknown>(
    key: string,
    type?: "json" | "text"
  ): Promise<T | null>;

  list(options?: {
    prefix?: string;
  }): Promise<{
    keys: Array<{ name: string }>;
  }>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function withRetries<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch {
    await sleep(100);
  }

  try {
    return await operation();
  } catch {
    await sleep(500);
  }

  return operation();
}

export function pairKey(
  chain: ChainName,
  pairAddress: string
): string {
  return `pair:${chain}:${pairAddress.toLowerCase()}`;
}

export class KVStoreImpl implements KVStore {
  constructor(
    private readonly kv: KVNamespaceLike
  ) {}

  async write(
    key: string,
    value: unknown,
    ttlSeconds: number = DEFAULT_KV_TTL_SECONDS
  ): Promise<void> {
    await withRetries(() =>
      this.kv.put(
        key,
        JSON.stringify(value),
        {
          expirationTtl: ttlSeconds,
        }
      )
    );
  }

  async read<T = unknown>(
    key: string
  ): Promise<T | null> {
    return this.kv.get<T>(
      key,
      "json"
    );
  }

  async listByChain(
    chain: ChainName
  ): Promise<NewPair[]> {
    const prefix =
      `pair:${chain}:`;

    const result =
      await this.kv.list({
        prefix,
      });

    const pairs: NewPair[] = [];

    for (
      const key of result.keys
    ) {
      try {
        const pair =
          await this.read<NewPair>(
            key.name
          );

        if (pair) {
          pairs.push(pair);
        }
      } catch {
        // Ignore malformed individual KV entries.
      }
    }

    return pairs;
  }

  async isDuplicate(
    key: string
  ): Promise<boolean> {
    const value =
      await this.kv.get(
        key,
        "text"
      );

    return value !== null;
  }
}
