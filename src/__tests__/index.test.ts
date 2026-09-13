import { describe, expect, test } from "vitest";
import worker, { type Env } from "../index";
import type { KvNamespaceLike } from "../kv";

function memoryKv(): KvNamespaceLike {
  const values = new Map<string, string>();
  return {
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => {
      values.set(key, value);
    },
    list: async (options) => ({
      keys: [...values.keys()]
        .filter((key) => (options?.prefix ? key.startsWith(options.prefix) : true))
        .map((name) => ({ name })),
      list_complete: true,
    }),
  };
}

function env(): Env {
  return {
    SNAPSHOTS_KV: memoryKv() as unknown as Env["SNAPSHOTS_KV"],
    X402_PAY_TO: "0x0000000000000000000000000000000000000001",
  };
}

describe("Worker routing", () => {
  test("serves a free health endpoint", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/health"),
      env(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });

  test("protects metrics with x402", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/metrics", { method: "POST" }),
      env(),
    );

    expect(response.status).toBe(402);
    expect(response.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
  });

  test("returns metrics after a payment signature is supplied", async () => {
    const environment = env();
    const response = await worker.fetch(
      new Request("https://example.test/metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-SIGNATURE": "base64-payload",
        },
        body: JSON.stringify({}),
      }),
      environment,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      snapshots: [],
      count: 0,
    });
  });
});
