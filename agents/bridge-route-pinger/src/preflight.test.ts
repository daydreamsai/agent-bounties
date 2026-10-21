/**
 * The preflight gate exists to stop the endpoint from charging for work it will refuse. Each case here
 * is a request that must be rejected before the paywall, plus the ones that must still get through.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { quotePreflight } from "./preflight.ts";

const ok = { token: "USDC", amount: "10", from_chain: "base", to_chain: "arbitrum" };

test("a well-formed request passes", () => {
  const r = quotePreflight(ok);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual([r.fromChain, r.toChain], [8453, 42161]);
});

test("chain ids are accepted in place of names", () => {
  assert.equal(quotePreflight({ ...ok, from_chain: "8453", to_chain: "10" }).ok, true);
});

test("a raw token address passes even when the table has no entry", () => {
  const r = quotePreflight({ ...ok, token: "0x0000000000000000000000000000000000000001", to_chain: "optimism" });
  assert.equal(r.ok, true);
});

test("an unknown chain is rejected", () => {
  const r = quotePreflight({ ...ok, to_chain: "notachain" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /unknown to_chain/);
});

test("the same chain on both sides is rejected", () => {
  const r = quotePreflight({ ...ok, to_chain: "base" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /must differ/);
});

test("a symbol the destination chain does not list is rejected before payment", () => {
  // POL exists on polygon only, so asking for it on base cannot be served.
  const r = quotePreflight({ ...ok, token: "POL", from_chain: "polygon", to_chain: "base" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /not on the built-in table for chain 8453/);
});

test("a zero, negative or non-numeric amount is rejected", () => {
  for (const amount of ["0", "-1", "abc", "", "1e5"]) {
    assert.equal(quotePreflight({ ...ok, amount }).ok, false, amount);
  }
  for (const amount of ["0.000001", "10", "10.5"]) {
    assert.equal(quotePreflight({ ...ok, amount }).ok, true, amount);
  }
});

test("a missing token is rejected", () => {
  const r = quotePreflight({ ...ok, token: "  " });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /token is required/);
});
