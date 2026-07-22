import { describe, expect, test } from "bun:test";
import { extractHolders } from "../holders";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function padAddress(addr: string): string {
  const clean = addr.replace("0x", "").toLowerCase();
  return "0x" + clean.padStart(64, "0");
}

describe("extractHolders", () => {
  test("extracts holders from Transfer mint events in creation tx", async () => {
    const txHash = "0xabc123";
    const pairAddress = "0x1111111111111111111111111111111111111111";
    const token0 = "0x2222222222222222222222222222222222222222";
    const token1 = "0x3333333333333333333333333333333333333333";
    const deployer = "0x4444444444444444444444444444444444444444";
    const holder1 = "0x5555555555555555555555555555555555555555";
    const holder2 = "0x6666666666666666666666666666666666666666";

    const mockProvider = {
      getTransactionReceipt: async (hash: string) => {
        if (hash !== txHash) return null;
        return {
          status: 1,
          from: deployer,
          logs: [
            {
              address: token0,
              topics: [
                TRANSFER_TOPIC,
                padAddress(ZERO_ADDRESS),
                padAddress(holder1),
              ],
              data: "0x01",
            },
            {
              address: token1,
              topics: [
                TRANSFER_TOPIC,
                padAddress(ZERO_ADDRESS),
                padAddress(holder2),
              ],
              data: "0x02",
            },
          ],
        };
      },
    };

    const holders = await extractHolders(
      mockProvider as any,
      txHash,
      pairAddress,
      token0,
      token1
    );

    expect(holders).toContain(deployer);
    expect(holders).toContain(pairAddress);
    expect(holders).toContain(holder1);
    expect(holders).toContain(holder2);
  });

  test("returns fallback [deployer, pairAddress] when fewer than 3 holders found", async () => {
    const txHash = "0xdef456";
    const pairAddress = "0x1111111111111111111111111111111111111111";
    const token0 = "0x2222222222222222222222222222222222222222";
    const token1 = "0x3333333333333333333333333333333333333333";
    const deployer = "0x4444444444444444444444444444444444444444";

    const mockProvider = {
      getTransactionReceipt: async (hash: string) => {
        if (hash !== txHash) return null;
        return {
          status: 1,
          from: deployer,
          logs: [],
        };
      },
    };

    const holders = await extractHolders(
      mockProvider as any,
      txHash,
      pairAddress,
      token0,
      token1
    );

    expect(holders).toHaveLength(2);
    expect(holders).toContain(deployer);
    expect(holders).toContain(pairAddress);
  });

  test("returns empty array when receipt not found", async () => {
    const txHash = "0xmissing";
    const pairAddress = "0x1111111111111111111111111111111111111111";
    const token0 = "0x2222222222222222222222222222222222222222";
    const token1 = "0x3333333333333333333333333333333333333333";

    const mockProvider = {
      getTransactionReceipt: async (hash: string) => {
        return null;
      },
    };

    const holders = await extractHolders(
      mockProvider as any,
      txHash,
      pairAddress,
      token0,
      token1
    );

    expect(holders).toEqual([]);
  });

  test("limits result to max 10 holders", async () => {
    const txHash = "0xmany";
    const pairAddress = "0x1111111111111111111111111111111111111111";
    const token0 = "0x2222222222222222222222222222222222222222";
    const token1 = "0x3333333333333333333333333333333333333333";
    const deployer = "0x4444444444444444444444444444444444444444";

    const mockProvider = {
      getTransactionReceipt: async (hash: string) => {
        if (hash !== txHash) return null;
        const logs = [];
        for (let i = 0; i < 15; i++) {
          const holder = "0x" + (i + 10).toString().padStart(40, "0");
          logs.push({
            address: token0,
            topics: [
              TRANSFER_TOPIC,
              padAddress(ZERO_ADDRESS),
              padAddress(holder),
            ],
            data: "0x01",
          });
        }
        return {
          status: 1,
          from: deployer,
          logs,
        };
      },
    };

    const holders = await extractHolders(
      mockProvider as any,
      txHash,
      pairAddress,
      token0,
      token1
    );

    expect(holders.length).toBeLessThanOrEqual(10);
  });
});
