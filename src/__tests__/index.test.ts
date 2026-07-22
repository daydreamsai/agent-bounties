import { describe, expect, test } from "bun:test";
import worker from "../index";

describe("Worker routing", () => {
  test("routes GET /health to handleHealth", async () => {
    const mockKV = {
      list: async () => ({ keys: [], list_complete: true, cursor: "" }),
      get: async () => null,
      put: async () => {},
    };

    const env = {
      PAIRS_KV: mockKV,
      ALCHEMY_API_KEY: "test-key",
    };

    const state = { lastWebhook: "", lastCron: "" };
    const ctx = { waitUntil: () => {} };

    const req = new Request("https://example.com/health", { method: "GET" });
    const response = await worker.fetch(req, env, ctx);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("routes POST /scan to handleScan with x402", async () => {
    const mockKV = {
      list: async () => ({ keys: [], list_complete: true, cursor: "" }),
      get: async () => null,
      put: async () => {},
    };

    const env = {
      PAIRS_KV: mockKV,
      ALCHEMY_API_KEY: "test-key",
    };

    const ctx = { waitUntil: () => {} };

    const req = new Request("https://example.com/scan", {
      method: "POST",
      headers: { "x402-payment": "valid-token" },
      body: JSON.stringify({ chain: "ethereum" }),
    });

    const response = await worker.fetch(req, env, ctx);
    expect(response.status).toBe(200);
  });

  test("rejects POST /scan without payment", async () => {
    const mockKV = {
      list: async () => ({ keys: [], list_complete: true, cursor: "" }),
      get: async () => null,
      put: async () => {},
    };

    const env = {
      PAIRS_KV: mockKV,
      ALCHEMY_API_KEY: "test-key",
    };

    const ctx = { waitUntil: () => {} };

    const req = new Request("https://example.com/scan", {
      method: "POST",
      body: JSON.stringify({ chain: "ethereum" }),
    });

    const response = await worker.fetch(req, env, ctx);
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.x402Version).toBe(2);
    expect(body.error).toBe("Payment required");
  });

  test("routes POST /webhook to handleWebhook", async () => {
    const mockKV = {
      list: async () => ({ keys: [], list_complete: true, cursor: "" }),
      get: async () => null,
      put: async () => {},
    };

    const mockProvider = {
      getTransactionReceipt: async () => null,
      getCode: async () => "0x",
      getBlockNumber: async () => 1000,
    };

    const env = {
      PAIRS_KV: mockKV,
      ALCHEMY_API_KEY: "test-key",
    };

    const ctx = { waitUntil: () => {} };

    const req = new Request("https://example.com/webhook", {
      method: "POST",
      body: JSON.stringify({ event: { data: { logs: [] } } }),
    });

    const response = await worker.fetch(req, env, ctx);
    expect(response.status).toBe(200);
  });
});
