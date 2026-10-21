/**
 * Gate for the pure half of the agent: resolution, atomic math, LI.FI mapping and ranking.
 * Run with `node --test --experimental-strip-types src/index.test.ts`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAINS,
  fromAtomic,
  rank,
  resolveChain,
  resolveToken,
  toAtomic,
  toRouteOut,
  type RouteOut,
} from "./index.ts";

test("resolveChain accepts names, ids and rejects junk", () => {
  assert.equal(resolveChain("base"), 8453);
  assert.equal(resolveChain(" Base "), 8453);
  assert.equal(resolveChain("42161"), 42161);
  assert.equal(resolveChain(137), 137);
  assert.equal(resolveChain("notachain"), null);
  assert.equal(resolveChain("0"), null);
});

test("every advertised chain resolves back to its own id", () => {
  for (const [name, id] of Object.entries(CHAINS)) assert.equal(resolveChain(name), id, name);
});

test("resolveToken prefers the chain table, then accepts a raw address", () => {
  assert.equal(resolveToken(8453, "usdc")?.decimals, 6);
  assert.equal(resolveToken(8453, "USDC")?.address, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  assert.equal(resolveToken(8453, "WETH")?.decimals, 18);
  assert.equal(resolveToken(999, "USDC"), null);
  assert.equal(resolveToken(999, "0x0000000000000000000000000000000000000001")?.decimals, 18);
});

test("toAtomic and fromAtomic round-trip without float drift", () => {
  assert.equal(toAtomic("10", 6), "10000000");
  assert.equal(toAtomic("10.5", 6), "10500000");
  assert.equal(toAtomic("0.000001", 6), "1");
  assert.equal(toAtomic("0.1234567", 6), "123456");
  assert.equal(toAtomic("1", 18), "1000000000000000000");
  assert.equal(fromAtomic("9975000", 6), 9.975);
  assert.equal(fromAtomic("0", 6), 0);
});

/** One real LI.FI route, trimmed to the fields the mapper reads. */
const ROUTE = {
  toAmount: "9975000",
  toAmountUSD: "9.9831",
  gasCostUSD: "0.0051",
  containsSwitchChain: true,
  steps: [
    {
      tool: "polymerStandard",
      estimate: {
        executionDuration: 1080,
        approvalAddress: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
        feeCosts: [
          { amountUSD: "0.0250" },
          { amountUSD: "0.0015" },
          { amountUSD: null },
        ],
      },
      action: { fromToken: { symbol: "USDC" } },
    },
    { tool: "second", estimate: {} },
  ],
};

test("toRouteOut copies live numbers and sums every fee", () => {
  const out = toRouteOut(ROUTE, 6);
  assert.equal(out.bridge, "polymerStandard");
  assert.equal(out.eta_minutes, 18);
  assert.equal(out.fee_usd, 0.0265);
  assert.equal(out.to_amount, 9.975);
  assert.equal(out.to_amount_usd, 9.9831);
  assert.equal(out.gas_usd, 0.0051);
  assert.equal(out.steps, 2);
  assert.deepEqual(out.requirements, [
    "wallet must switch chain",
    "approve token at 0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
    "hold USDC for gas",
  ]);
});

test("a missing or zero duration is null, never instant", () => {
  const base = { toAmount: "1000000", steps: [{ tool: "x", estimate: {} }] };
  assert.equal(toRouteOut(base, 6).eta_minutes, null);
  const zero = { toAmount: "1000000", steps: [{ tool: "x", estimate: { executionDuration: 0 } }] };
  assert.equal(toRouteOut(zero, 6).eta_minutes, null);
  const subMinute = { toAmount: "1000000", steps: [{ tool: "x", estimate: { executionDuration: 4 } }] };
  assert.equal(toRouteOut(subMinute, 6).eta_minutes, 1);
});

test("toRouteOut tolerates a route with no steps or gas figure", () => {
  const out = toRouteOut({ toAmount: "500000" }, 6);
  assert.equal(out.bridge, "unknown");
  assert.equal(out.fee_usd, 0);
  assert.equal(out.gas_usd, null);
  assert.equal(out.eta_minutes, null);
  assert.deepEqual(out.requirements, []);
  assert.equal(out.steps, 0);
});

function route(over: Partial<RouteOut>): RouteOut {
  return {
    bridge: "b", eta_minutes: 10, fee_usd: 0.02, to_amount: 9.9,
    to_amount_usd: 9.9, gas_usd: 0.01, requirements: [], steps: 1, ...over,
  };
}

test("ranking puts the larger delivered amount first even at equal fee", () => {
  const worse = route({ bridge: "worse", fee_usd: 0.025, to_amount_usd: 9.9669, eta_minutes: 0 });
  const better = route({ bridge: "better", fee_usd: 0.025, to_amount_usd: 9.9836, eta_minutes: 18 });
  assert.deepEqual([worse, better].sort(rank).map((r) => r.bridge), ["better", "worse"]);
});

test("ranking breaks a delivery tie by the faster route", () => {
  const slow = route({ bridge: "slow", eta_minutes: 40 });
  const fast = route({ bridge: "fast", eta_minutes: 2 });
  assert.deepEqual([slow, fast].sort(rank).map((r) => r.bridge), ["fast", "slow"]);
});

test("an unreported ETA never outranks a known one on a tie", () => {
  const unknown = route({ bridge: "unknown", eta_minutes: null });
  const known = route({ bridge: "known", eta_minutes: 30 });
  assert.deepEqual([unknown, known].sort(rank).map((r) => r.bridge), ["known", "unknown"]);
});

test("ranking falls back to token amount when no USD figure is quoted", () => {
  const a = route({ bridge: "a", to_amount: 9.8, to_amount_usd: null });
  const b = route({ bridge: "b", to_amount: 9.9, to_amount_usd: null });
  assert.deepEqual([a, b].sort(rank).map((r) => r.bridge), ["b", "a"]);
});
