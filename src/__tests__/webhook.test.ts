import { describe, expect, test } from "bun:test";
import { handleWebhook } from "../webhook";

const PAIR_CREATED_TOPIC = "0x0d3648bd0f6ba80134a33ba9275ac585d9d315d0ad8f784421bc79d610934ca5";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function padAddress(addr: string): string {
  const clean = addr.replace("0x", "").toLowerCase();
  return "0x" + clean.padStart(64, "0");
}

describe("handleWebhook", () => {
  test("processes valid PairCreated event and stores in KV", async () => {
    const token0 = "0x2222222222222222222222222222222222222222";
    const token1 = "0x3333333333333333333333333333333333333333";
    const pairAddress = "0x4444444444444444444444444444444444444444";
    const deployer = "0x5555555555555555555555555555555555555555";
    const txHash = "0xabc123";

    const payload = {
      event: {
        transaction: {
          hash: txHash,
          from: deployer,
        },
        blockchain: {
          network: "eth-mainnet",
        },
        data: {
          logs: [
            {
              address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
              topics: [
                PAIR_CREATED_TOPIC,
                padAddress(token0),
                padAddress(token1),
              ],
              data: padAddress(pairAddress),
            },
          ],
        },
      },
    };

    const storedPairs: any[] = [];
    const mockKV = {
      put: async (key: string, value: string) => {
        if (key.startsWith("state:")) {
          return;
        }
        storedPairs.push({ key, value: JSON.parse(value) });
      },
      get: async (key: string) => null,
    };

    const mockProvider = {
      getTransactionReceipt: async (hash: string) => {
        return {
          status: 1,
          from: deployer,
          logs: [],
        };
      },
      getCode: async (addr: string) => "0x6080",
      getBlockNumber: async () => 1000,
    };

    const state = { lastWebhook: "", lastCron: "" };

    const result = await handleWebhook(payload as any, mockProvider as any, mockKV as any, state);

    expect(result.success).toBe(true);
    expect(storedPairs).toHaveLength(1);
    expect(storedPairs[0].value.pair_address).toBe(pairAddress);
    expect(storedPairs[0].value.top_holders).toContain(deployer);
    expect(state.lastWebhook).toBeTruthy();
  });

  test("skips pair if already exists in KV", async () => {
    const token0 = "0x2222222222222222222222222222222222222222";
    const token1 = "0x3333333333333333333333333333333333333333";
    const pairAddress = "0x4444444444444444444444444444444444444444";
    const deployer = "0x5555555555555555555555555555555555555555";
    const txHash = "0xabc123";

    const payload = {
      event: {
        transaction: { hash: txHash, from: deployer },
        blockchain: { network: "eth-mainnet" },
        data: {
          logs: [
            {
              address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
              topics: [PAIR_CREATED_TOPIC, padAddress(token0), padAddress(token1)],
              data: padAddress(pairAddress),
            },
          ],
        },
      },
    };

    const existingPair = {
      pair_address: pairAddress,
      tokens: [],
      init_liquidity: { token0_raw: "0", token1_raw: "0" },
      top_holders: [],
      created_at: new Date().toISOString(),
    };

    const storedPairs: any[] = [];
    const mockKV = {
      put: async (key: string, value: string) => {
        storedPairs.push({ key, value: JSON.parse(value) });
      },
      get: async (key: string) => {
        if (key === `pair:ethereum:${pairAddress}`) {
          return JSON.stringify(existingPair);
        }
        return null;
      },
    };

    const mockProvider = {
      getTransactionReceipt: async () => ({ status: 1, from: deployer, logs: [] }),
      getCode: async () => "0x6080",
      getBlockNumber: async () => 1000,
    };

    const state = { lastWebhook: "", lastCron: "" };
    const result = await handleWebhook(payload as any, mockProvider as any, mockKV as any, state);

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(storedPairs).toHaveLength(0);
  });

  test("rejects failed transaction", async () => {
    const token0 = "0x2222222222222222222222222222222222222222";
    const token1 = "0x3333333333333333333333333333333333333333";
    const pairAddress = "0x4444444444444444444444444444444444444444";
    const deployer = "0x5555555555555555555555555555555555555555";
    const txHash = "0xfailed";

    const payload = {
      event: {
        transaction: { hash: txHash, from: deployer },
        blockchain: { network: "eth-mainnet" },
        data: {
          logs: [
            {
              address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
              topics: [PAIR_CREATED_TOPIC, padAddress(token0), padAddress(token1)],
              data: padAddress(pairAddress),
            },
          ],
        },
      },
    };

    const mockKV = {
      put: async () => {},
      get: async () => null,
    };

    const mockProvider = {
      getTransactionReceipt: async () => ({ status: 0, from: deployer, logs: [] }),
      getCode: async () => "0x6080",
      getBlockNumber: async () => 1000,
    };

    const state = { lastWebhook: "", lastCron: "" };
    const result = await handleWebhook(payload as any, mockProvider as any, mockKV as any, state);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Transaction failed or not found");
  });

  test("rejects non-existent contract", async () => {
    const token0 = "0x2222222222222222222222222222222222222222";
    const token1 = "0x3333333333333333333333333333333333333333";
    const pairAddress = "0x4444444444444444444444444444444444444444";
    const deployer = "0x5555555555555555555555555555555555555555";
    const txHash = "0xghost";

    const payload = {
      event: {
        transaction: { hash: txHash, from: deployer },
        blockchain: { network: "eth-mainnet" },
        data: {
          logs: [
            {
              address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
              topics: [PAIR_CREATED_TOPIC, padAddress(token0), padAddress(token1)],
              data: padAddress(pairAddress),
            },
          ],
        },
      },
    };

    const mockKV = {
      put: async () => {},
      get: async () => null,
    };

    const mockProvider = {
      getTransactionReceipt: async () => ({ status: 1, from: deployer, logs: [] }),
      getCode: async () => "0x",
      getBlockNumber: async () => 1000,
    };

    const state = { lastWebhook: "", lastCron: "" };
    const result = await handleWebhook(payload as any, mockProvider as any, mockKV as any, state);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Contract does not exist");
  });
});
