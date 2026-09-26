import test from "node:test";
import assert from "node:assert/strict";
import { createServer, getBridgeRoutes } from "../src/bridge-route-pinger.js";

const quote = {
  id: "quote-1",
  toolDetails: { name: "ExampleBridge" },
  action: {
    fromChainId: 1,
    toChainId: 10,
    fromToken: { symbol: "USDC" },
  },
  estimate: {
    executionDuration: 125,
    toAmount: "9980000",
    feeCosts: [{ amountUSD: "1.25" }, { amountUSD: "0.05" }],
    gasCosts: [{ amount: "0.0004", amountUSD: "1.10", token: { symbol: "ETH", chainId: 1 } }],
  },
};

function response(payload, ok = true, status = 200) {
  return { ok, status, json: async () => payload };
}

test("requests an official quote and normalizes fee, ETA, and requirements", async () => {
  let requested;
  const result = await getBridgeRoutes(
    { token: "0xusdc", amount: "10000000", from_chain: "1", to_chain: "10" },
    {
      endpoint: "https://quotes.example/quote",
      fetch: async (url, init) => {
        requested = { url: String(url), init };
        return response(quote);
      },
    },
  );

  assert.equal(new URL(requested.url).searchParams.get("fromAmount"), "10000000");
  assert.equal(new URL(requested.url).searchParams.get("fromToken"), "0xusdc");
  assert.equal(new URL(requested.url).searchParams.get("toToken"), "0xusdc");
  assert.equal(requested.init.headers.accept, "application/json");
  assert.equal(result.routes[0].bridge, "ExampleBridge");
  assert.equal(result.routes[0].eta_minutes, 3);
  assert.equal(result.routes[0].fee_usd, 1.3);
  assert.deepEqual(result.routes[0].requirements, [{
    type: "gas",
    token: "ETH",
    amount: "0.0004",
    amount_usd: 1.1,
    chain: 1,
  }]);
  assert.equal(result.routes[0].received_amount, "9980000");
  assert.match(result.fetched_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("accepts a provider payload without routes and preserves unknown values", async () => {
  const result = await getBridgeRoutes(
    { token: "USDC", amount: 1, from_chain: "ethereum", to_chain: "arbitrum" },
    { fetch: async () => response({ action: {}, estimate: {} }) },
  );

  assert.equal(result.routes.length, 1);
  assert.equal(result.routes[0].eta_minutes, null);
  assert.equal(result.routes[0].fee_usd, null);
  assert.deepEqual(result.routes[0].requirements, []);
});

test("rejects invalid input and provider failures", async () => {
  await assert.rejects(
    getBridgeRoutes({ token: "USDC", amount: "1.2.3", from_chain: "1", to_chain: "10" }, { fetch: async () => response({}) }),
    /amount must be/,
  );
  await assert.rejects(
    getBridgeRoutes({ token: "USDC", amount: "1", from_chain: "1", to_chain: "10" }, { fetch: async () => response({}, false, 503) }),
    /HTTP 503/,
  );
});

test("serves POST /quote and returns a client error for malformed JSON", async () => {
  const handler = createServer({ fetch: async () => response(quote) });
  const result = await handler(new Request("http://localhost/quote", {
    method: "POST",
    body: JSON.stringify({ token: "USDC", amount: "1", from_chain: "1", to_chain: "10" }),
  }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).routes[0].id, "quote-1");

  const malformed = await handler(new Request("http://localhost/quote", { method: "POST", body: "{" }));
  assert.equal(malformed.status, 400);
  assert.match((await malformed.json()).error, /valid JSON/);
});
