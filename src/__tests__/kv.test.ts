import { describe, expect, test } from "bun:test";
import { writePair, readPair, hasPair, listPairsByChain } from "../kv";
import type { NewPair } from "../types";

describe("KV helpers", () => {
  test("writePair stores a pair and readPair retrieves it", async () => {
    // Mock KV store (in-memory Map)
    const mockKV = new Map<string, string>();
    const kvBinding = {
      put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
        mockKV.set(key, value);
      },
      get: async (key: string) => {
        return mockKV.get(key) || null;
      },
    };

    const testPair: NewPair = {
      pair_address: "0x1234567890abcdef1234567890abcdef12345678",
      tokens: [
        { address: "0xtoken0", symbol: "TK0" },
        { address: "0xtoken1", symbol: "TK1" },
      ],
      init_liquidity: {
        token0_raw: "1000000000000000000",
        token1_raw: "2000000000",
      },
      top_holders: ["0xholder1", "0xholder2"],
      created_at: "2026-07-10T00:00:00.000Z",
    };

    const chain = "ethereum";

    // Write the pair
    await writePair(kvBinding as any, chain, testPair);

    // Read it back
    const retrieved = await readPair(kvBinding as any, chain, testPair.pair_address);

    // Verify it matches
    expect(retrieved).toEqual(testPair);
  });

  test("hasPair returns true for existing pair, false for missing", async () => {
    const mockKV = new Map<string, string>();
    const kvBinding = {
      put: async (key: string, value: string) => {
        mockKV.set(key, value);
      },
      get: async (key: string) => {
        return mockKV.get(key) || null;
      },
    };

    const testPair: NewPair = {
      pair_address: "0xabcdef",
      tokens: [],
      init_liquidity: { token0_raw: "0", token1_raw: "0" },
      top_holders: [],
      created_at: "2026-07-10T00:00:00.000Z",
    };

    const chain = "ethereum";

    expect(await hasPair(kvBinding as any, chain, testPair.pair_address)).toBe(false);

    await writePair(kvBinding as any, chain, testPair);

    expect(await hasPair(kvBinding as any, chain, testPair.pair_address)).toBe(true);

    expect(await hasPair(kvBinding as any, chain, "0xother")).toBe(false);
  });

  test("listPairsByChain returns pairs within time window, excludes other chains", async () => {
    const mockKV = new Map<string, string>();
    const kvBinding = {
      put: async (key: string, value: string) => {
        mockKV.set(key, value);
      },
      get: async (key: string) => {
        return mockKV.get(key) || null;
      },
      list: async (options?: { prefix?: string }) => {
        const keys = Array.from(mockKV.keys());
        const filtered = options?.prefix
          ? keys.filter((k) => k.startsWith(options.prefix!))
          : keys;
        return {
          keys: filtered.map((name) => ({ name })),
          list_complete: true,
          cursor: "",
        };
      },
    };

    const now = new Date("2026-07-10T12:00:00.000Z");
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const recentPair: NewPair = {
      pair_address: "0xrecent",
      tokens: [],
      init_liquidity: { token0_raw: "0", token1_raw: "0" },
      top_holders: [],
      created_at: fiveMinAgo.toISOString(),
    };

    const oldPair: NewPair = {
      pair_address: "0xold",
      tokens: [],
      init_liquidity: { token0_raw: "0", token1_raw: "0" },
      top_holders: [],
      created_at: fifteenMinAgo.toISOString(),
    };

    const otherChainPair: NewPair = {
      pair_address: "0xother",
      tokens: [],
      init_liquidity: { token0_raw: "0", token1_raw: "0" },
      top_holders: [],
      created_at: fiveMinAgo.toISOString(),
    };

    await writePair(kvBinding as any, "ethereum", recentPair);
    await writePair(kvBinding as any, "ethereum", oldPair);
    await writePair(kvBinding as any, "bsc", otherChainPair);

    const results = await listPairsByChain(kvBinding as any, "ethereum", 10, now);

    expect(results).toHaveLength(1);
    expect(results[0].pair_address).toBe("0xrecent");
  });

  test("writePair retries on transient failure and succeeds", async () => {
    let callCount = 0;
    const mockKV = new Map<string, string>();
    const kvBinding = {
      put: async (key: string, value: string) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Transient failure");
        }
        mockKV.set(key, value);
      },
      get: async (key: string) => {
        return mockKV.get(key) || null;
      },
    };

    const testPair: NewPair = {
      pair_address: "0xretry",
      tokens: [],
      init_liquidity: { token0_raw: "0", token1_raw: "0" },
      top_holders: [],
      created_at: "2026-07-10T00:00:00.000Z",
    };

    await writePair(kvBinding as any, "ethereum", testPair);

    const retrieved = await readPair(kvBinding as any, "ethereum", testPair.pair_address);
    expect(retrieved).toEqual(testPair);
    expect(callCount).toBe(2);
  });
});
