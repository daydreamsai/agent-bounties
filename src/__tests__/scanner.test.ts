import { describe, expect, test } from "bun:test";
import { handleCron } from "../scanner";

const PAIR_CREATED_TOPIC = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315d0ad8f784421bc79d610934ca5";

function padAddress(addr: string): string {
  const clean = addr.replace("0x", "").toLowerCase();
  return "0x" + clean.padStart(64, "0");
}

describe("handleCron", () => {
  test("scans blocks and stores new pairs", async () => {
    const token0 = "0x2222222222222222222222222222222222222222";
    const token1 = "0x3333333333333333333333333333333333333333";
    const pairAddress = "0x4444444444444444444444444444444444444444";
    const deployer = "0x5555555555555555555555555555555555555555";
    const txHash = "0xabc123";

    const storedPairs: any[] = [];
    const kvStore = new Map<string, string>();
    const mockKV = {
      put: async (key: string, value: string) => {
        if (key.startsWith("state:")) {
          kvStore.set(key, value);
          return;
        }
        kvStore.set(key, value);
        storedPairs.push({ key, value: JSON.parse(value) });
      },
      get: async (key: string) => kvStore.get(key) || null,
    };

    const mockProvider = {
      getBlockNumber: async () => 1000,
      getLogs: async (filter: any) => {
        return [
          {
            transactionHash: txHash,
            topics: [PAIR_CREATED_TOPIC, padAddress(token0), padAddress(token1)],
            data: padAddress(pairAddress),
            address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
          },
        ];
      },
      getTransactionReceipt: async () => ({
        status: 1,
        from: deployer,
        logs: [],
      }),
      getCode: async () => "0x6080",
    };

    const state = { lastWebhook: "", lastCron: "" };
    const count = await handleCron(mockKV as any, mockProvider as any, state, "ethereum");

    expect(count).toBe(1);
    expect(storedPairs).toHaveLength(1);
    expect(storedPairs[0].value.pair_address).toBe(pairAddress);
    expect(state.lastCron).toBeTruthy();
  });

  test("skips pairs already in KV", async () => {
    const pairAddress = "0x4444444444444444444444444444444444444444";

    const storedPairs: any[] = [];
    const mockKV = {
      put: async (key: string, value: string) => {
        if (key.startsWith("state:")) {
          return;
        }
        storedPairs.push({ key, value: JSON.parse(value) });
      },
      get: async (key: string) => {
        if (key === `pair:ethereum:${pairAddress}`) {
          return JSON.stringify({ pair_address: pairAddress });
        }
        return null;
      },
    };

    const mockProvider = {
      getBlockNumber: async () => 1000,
      getLogs: async () => [
        {
          transactionHash: "0xabc",
          topics: [
            PAIR_CREATED_TOPIC,
            padAddress("0x2222222222222222222222222222222222222222"),
            padAddress("0x3333333333333333333333333333333333333333"),
          ],
          data: padAddress(pairAddress),
          address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        },
      ],
      getTransactionReceipt: async () => ({ status: 1, from: "0x0", logs: [] }),
      getCode: async () => "0x6080",
    };

    const state = { lastWebhook: "", lastCron: "" };
    const count = await handleCron(mockKV as any, mockProvider as any, state, "ethereum");

    expect(count).toBe(0);
    expect(storedPairs).toHaveLength(0);
  });

  test("stops processing after 25 seconds", async () => {
    const mockKV = {
      put: async () => {},
      get: async () => null,
    };

    let logsCallCount = 0;
    let timeOffset = 0;
    const originalDateNow = Date.now;
    Date.now = () => originalDateNow() + timeOffset;

    const mockProvider = {
      getBlockNumber: async () => 1000,
      getLogs: async () => {
        logsCallCount++;
        return Array.from({ length: 50 }, (_, i) => ({
          transactionHash: `0x${i}`,
          topics: [
            PAIR_CREATED_TOPIC,
            padAddress("0x2222222222222222222222222222222222222222"),
            padAddress("0x3333333333333333333333333333333333333333"),
          ],
          data: padAddress(`0x${i.toString().padStart(40, "0")}`),
          address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        }));
      },
      getTransactionReceipt: async () => {
        timeOffset += 1000;
        return { status: 1, from: "0x0", logs: [] };
      },
      getCode: async () => "0x6080",
    };

    const state = { lastWebhook: "", lastCron: "" };
    const count = await handleCron(mockKV as any, mockProvider as any, state, "ethereum");
    
    Date.now = originalDateNow;

    expect(count).toBeLessThan(50);
    expect(count).toBeGreaterThan(0);
  });
});
