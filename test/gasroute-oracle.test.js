import assert from "node:assert/strict";
import test from "node:test";
import { createGasRouteOracle } from "../src/gasroute-oracle.js";

const NOW = Date.parse("2026-09-26T12:00:00.000Z");

function observation(overrides = {}) {
  return {
    gas_price_native_per_unit: 0.000001,
    calldata_price_native_per_byte: 0.00001,
    native_usd: 2_000,
    priority_fee: 0.0000002,
    busy_level: "normal",
    observed_at: new Date(NOW - 1_000).toISOString(),
    ...overrides,
  };
}

test("selects the cheapest fresh chain and calculates native and USD fees", async () => {
  const oracle = createGasRouteOracle({
    now: () => NOW,
    getNetworkState: async (chain) => chain === "alpha"
      ? observation()
      : observation({
          gas_price_native_per_unit: 0.000002,
          native_usd: 1_500,
          priority_fee: 0.0000004,
          busy_level: "busy",
        }),
  });

  const result = await oracle.estimate({
    chain_set: ["alpha", "beta"],
    calldata_size_bytes: 100,
    gas_units_est: 100_000,
  });

  assert.deepEqual(result, {
    chain: "alpha",
    fee_native: 0.101,
    fee_usd: 202,
    busy_level: "normal",
    tip_hint: 0.0000002,
  });
});

test("ignores stale and unavailable chains when a fresh candidate remains", async () => {
  const calls = [];
  const oracle = createGasRouteOracle({
    now: () => NOW,
    getNetworkState: async (chain) => {
      calls.push(chain);
      if (chain === "stale") return observation({ observed_at: new Date(NOW - 31_000).toISOString() });
      if (chain === "down") throw new Error("provider unavailable");
      return observation({ gas_price_native_per_unit: 0.000003 });
    },
  });

  const result = await oracle.estimate({
    chain_set: ["stale", "down", "fresh"],
    calldata_size_bytes: 0,
    gas_units_est: 10_000,
  });

  assert.equal(result.chain, "fresh");
  assert.deepEqual(calls.sort(), ["down", "fresh", "stale"]);
});

test("fails when every chain lacks a fresh observation", async () => {
  const oracle = createGasRouteOracle({
    now: () => NOW,
    getNetworkState: async () => observation({ observed_at: new Date(NOW - 30_001).toISOString() }),
  });

  await assert.rejects(
    oracle.estimate({ chain_set: ["alpha"], calldata_size_bytes: 1, gas_units_est: 1 }),
    /No chain has a fresh gas observation/,
  );
});

test("rejects malformed request inputs", async () => {
  const oracle = createGasRouteOracle({ getNetworkState: async () => observation() });

  await assert.rejects(
    oracle.estimate({ chain_set: ["alpha"], calldata_size_bytes: -1, gas_units_est: 1 }),
    /calldata_size_bytes/,
  );
  await assert.rejects(
    oracle.estimate({ chain_set: [], calldata_size_bytes: 0, gas_units_est: 1 }),
    /chain_set/,
  );
});
