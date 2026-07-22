import { describe, expect, test } from "bun:test";
import { handleHealth, handleScan, withX402 } from "../endpoints";

describe("GET /health", () => {
  test("returns status ok with timestamps and pair count", async () => {
    const mockKV = {
      list: async () => ({
        keys: [{ name: "pair:ethereum:0x1" }, { name: "pair:bsc:0x2" }],
        list_complete: true,
        cursor: "",
      }),
      get: async (key: string) => null,
    };

    const state = {
      lastWebhook: "2026-07-10T12:00:00.000Z",
      lastCron: "2026-07-10T11:50:00.000Z",
    };

    const response = await handleHealth(mockKV as any, state);

    expect(response.status).toBe("ok");
    expect(response.last_webhook).toBe("2026-07-10T12:00:00.000Z");
    expect(response.last_cron).toBe("2026-07-10T11:50:00.000Z");
    expect(response.pairs_cached).toBe(2);
  });
});

describe("POST /scan", () => {
  test("returns pairs filtered by chain and window", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const mockKV = {
      list: async (opts?: { prefix?: string }) => {
        const keys = [
          { name: "pair:ethereum:0x1" },
          { name: "pair:ethereum:0x2" },
          { name: "pair:bsc:0x3" },
        ];
        const filtered = opts?.prefix
          ? keys.filter((k) => k.name.startsWith(opts.prefix))
          : keys;
        return { keys: filtered, list_complete: true, cursor: "" };
      },
      get: async (key: string) => {
        const pairs: Record<string, any> = {
          "pair:ethereum:0x1": {
            pair_address: "0x1",
            tokens: [],
            init_liquidity: { token0_raw: "0", token1_raw: "0" },
            top_holders: [],
            created_at: fiveMinAgo.toISOString(),
          },
          "pair:ethereum:0x2": {
            pair_address: "0x2",
            tokens: [],
            init_liquidity: { token0_raw: "0", token1_raw: "0" },
            top_holders: [],
            created_at: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
          },
          "pair:bsc:0x3": {
            pair_address: "0x3",
            tokens: [],
            init_liquidity: { token0_raw: "0", token1_raw: "0" },
            top_holders: [],
            created_at: fiveMinAgo.toISOString(),
          },
        };
        return pairs[key] ? JSON.stringify(pairs[key]) : null;
      },
    };

    const response = await handleScan(
      { chain: "ethereum", window_minutes: 10 },
      mockKV as any,
      now
    );

    expect(response.chain).toBe("ethereum");
    expect(response.window_minutes).toBe(10);
    expect(response.new_pairs).toHaveLength(1);
    expect(response.new_pairs[0].pair_address).toBe("0x1");
    expect(response.total_found).toBe(1);
  });

  test("filters by factories when provided", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const mockKV = {
      list: async () => ({
        keys: [
          { name: "pair:ethereum:0xAAA" },
          { name: "pair:ethereum:0xBBB" },
          { name: "pair:ethereum:0xCCC" },
        ],
        list_complete: true,
        cursor: "",
      }),
      get: async (key: string) => {
        const pairs: Record<string, any> = {
          "pair:ethereum:0xAAA": {
            pair_address: "0xAAA",
            tokens: [],
            init_liquidity: { token0_raw: "0", token1_raw: "0" },
            top_holders: [],
            created_at: fiveMinAgo.toISOString(),
          },
          "pair:ethereum:0xBBB": {
            pair_address: "0xBBB",
            tokens: [],
            init_liquidity: { token0_raw: "0", token1_raw: "0" },
            top_holders: [],
            created_at: fiveMinAgo.toISOString(),
          },
          "pair:ethereum:0xCCC": {
            pair_address: "0xCCC",
            tokens: [],
            init_liquidity: { token0_raw: "0", token1_raw: "0" },
            top_holders: [],
            created_at: fiveMinAgo.toISOString(),
          },
        };
        return pairs[key] ? JSON.stringify(pairs[key]) : null;
      },
    };

    const response = await handleScan(
      { chain: "ethereum", factories: ["0xAAA", "0xCCC"], window_minutes: 10 },
      mockKV as any,
      now
    );

    expect(response.new_pairs).toHaveLength(2);
    expect(response.new_pairs.map((p) => p.pair_address)).toEqual(["0xAAA", "0xCCC"]);
  });
});

describe("x402 middleware", () => {
  test("allows request with valid payment header", async () => {
    const handler = async (req: any) => ({ result: "ok" });
    const wrapped = withX402(handler);

    const req = new Request("https://example.com/scan", {
      method: "POST",
      headers: { "x402-payment": "valid-token" },
    });

    const result = await wrapped(req);
    expect(result).toEqual({ result: "ok" });
  });

  test("rejects request without payment header and returns x402 requirements", async () => {
    const handler = async (req: any) => ({ result: "ok" });
    const wrapped = withX402(handler);

    const req = new Request("https://example.com/scan", {
      method: "POST",
    });

    const result = await wrapped(req);
    expect(result).toHaveProperty("x402Version");
    expect(result).toHaveProperty("error", "Payment required");
    expect(result).toHaveProperty("method", "POST");
    expect(result).toHaveProperty("path", "/scan");
    expect(result).toHaveProperty("resource");
    expect(result).toHaveProperty("network");
    expect(result).toHaveProperty("asset");
    expect(result).toHaveProperty("amount");
    expect(result).toHaveProperty("payTo");
    expect(result).toHaveProperty("facilitator");
  });
});
