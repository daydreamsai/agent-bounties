import { describe, expect, test } from "bun:test";
import { getChainConfig, getFactoryAddresses } from "../chains";

describe("Chain configs", () => {
  test("getChainConfig returns config for known chain", () => {
    const ethConfig = getChainConfig("ethereum");
    expect(ethConfig.chain).toBe("ethereum");
    expect(ethConfig.blocksPerMinute).toBeGreaterThan(0);
    expect(ethConfig.rpcUrl).toMatch(/^https?:\/\//);
    expect(ethConfig.factories.length).toBeGreaterThan(0);

    const bscConfig = getChainConfig("bsc");
    expect(bscConfig.chain).toBe("bsc");
    expect(bscConfig.blocksPerMinute).toBeGreaterThan(0);
  });

  test("getChainConfig throws for unknown chain", () => {
    expect(() => getChainConfig("unknown")).toThrow();
  });

  test("getFactoryAddresses returns hardcoded addresses", () => {
    const ethFactories = getFactoryAddresses("ethereum");
    expect(ethFactories).toContain("0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f");
    expect(ethFactories).toContain("0x1F98431c8aD98523631AE4a59f267346ea31F984");

    const bscFactories = getFactoryAddresses("bsc");
    expect(bscFactories).toContain("0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73");
    expect(bscFactories).toContain("0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865");
  });
});
