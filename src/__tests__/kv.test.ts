import { describe, expect, test } from "vitest";
import { asPoolId } from "../address";
import {
  hasSnapshot,
  listSnapshots,
  readSnapshot,
  writeSnapshot,
  type KvNamespaceLike,
} from "../kv";
import type { PoolSnapshot } from "../types";

const poolA = asPoolId("0x52908400098527886e0f7030069857d2e4169ee7");
const poolB = asPoolId("0x0000000000000000000000000000000000000002");

function snapshot(
  pool_id: PoolSnapshot["pool_id"],
  captured_at: string,
  tvl_usd = 100_000,
): PoolSnapshot {
  return {
    pool_id,
    protocol_id: "aave-v3",
    chain: "ethereum",
    captured_at,
    metrics: {
      apy: 5.2,
      tvl_usd,
      utilization: 0.7,
    },
  };
}

function memoryKv(): KvNamespaceLike {
  const values = new Map<string, string>();

  return {
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => {
      values.set(key, value);
    },
    list: async (options) => {
      const names = [...values.keys()].filter((key) =>
        options?.prefix ? key.startsWith(options.prefix) : true,
      );
      return {
        keys: names.map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
}

const noWait = { sleep: async () => undefined };

describe("snapshot KV helpers", () => {
  test("writes and reads the latest snapshot using a checksummed pool ID", async () => {
    const kv = memoryKv();
    const current = snapshot(poolA, "2026-09-13T12:00:00.000Z");

    await writeSnapshot(kv, current, { retry: noWait });

    expect(await readSnapshot(kv, poolA, { retry: noWait })).toEqual(current);
    expect(await hasSnapshot(kv, poolA, { retry: noWait })).toBe(true);
  });

  test("preserves the immediately previous snapshot for delta calculations", async () => {
    const kv = memoryKv();
    const first = snapshot(poolA, "2026-09-13T12:00:00.000Z", 100_000);
    const second = snapshot(poolA, "2026-09-13T12:10:00.000Z", 90_000);

    await writeSnapshot(kv, poolA, first, { retry: noWait });
    await writeSnapshot(kv, poolA, second, { retry: noWait });

    expect(
      await readSnapshot(kv, poolA, { version: "latest", retry: noWait }),
    ).toEqual(second);
    expect(
      await readSnapshot(kv, poolA, { version: "previous", retry: noWait }),
    ).toEqual(first);
  });

  test("lists only latest snapshots and orders them newest first", async () => {
    const kv = memoryKv();
    const older = snapshot(poolA, "2026-09-13T12:00:00.000Z");
    const newer = snapshot(poolB, "2026-09-13T12:10:00.000Z");

    await writeSnapshot(kv, older, { retry: noWait });
    await writeSnapshot(kv, newer, { retry: noWait });

    const result = await listSnapshots(kv, { retry: noWait });
    expect(result).toEqual([newer, older]);
  });

  test("retries a transient KV write with the documented backoff hook", async () => {
    const base = memoryKv();
    let putAttempts = 0;
    const kv: KvNamespaceLike = {
      get: base.get,
      list: base.list,
      put: async (key, value, options) => {
        putAttempts += 1;
        if (putAttempts === 1) {
          throw new Error("transient KV failure");
        }
        await base.put(key, value, options);
      },
    };

    await writeSnapshot(kv, snapshot(poolA, "2026-09-13T12:00:00.000Z"), {
      retry: noWait,
    });

    expect(putAttempts).toBe(2);
    expect(await hasSnapshot(kv, poolA, { retry: noWait })).toBe(true);
  });

  test("rejects a snapshot whose pool ID is not checksummed", async () => {
    const kv = memoryKv();
    const unchecksummed = snapshot(
      "0x52908400098527886e0f7030069857d2e4169ee7" as PoolSnapshot["pool_id"],
      "2026-09-13T12:00:00.000Z",
    );

    await expect(
      writeSnapshot(kv, unchecksummed, { retry: noWait }),
    ).rejects.toThrow("checksummed");
  });
});
