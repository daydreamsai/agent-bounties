import test from "node:test";
import assert from "node:assert/strict";
import { estimateFromPools, normalizePair, resolveAmountUsd } from "../src/core.js";

test("normalizePair accepts Dexscreener-shaped data", () => {
  const pool = normalizePair({
    chainId: "base",
    dexId: "uniswap",
    pairAddress: "0xabc",
    liquidity: { usd: 1000000 },
    volume: { h24: 250000 },
    txns: { h24: { buys: 80, sells: 70 } },
    priceChange: { h24: -2.5 }
  });

  assert.equal(pool.chain, "base");
  assert.equal(pool.txns_24h, 150);
  assert.equal(pool.volatility_pct, 2.5);
});

test("estimateFromPools increases slippage for larger trades", () => {
  const pools = [
    {
      chainId: "base",
      dexId: "uniswap",
      pairAddress: "0x1",
      liquidity: { usd: 1_000_000 },
      volume: { h24: 300_000 },
      txns: { h24: { buys: 100, sells: 100 } },
      priceChange: { h24: 1.2 }
    }
  ];

  const small = estimateFromPools({ amount_usd: 1_000 }, pools);
  const large = estimateFromPools({ amount_usd: 50_000 }, pools);

  assert.ok(large.min_safe_slip_bps > small.min_safe_slip_bps);
  assert.equal(small.pool_depths.length, 1);
});

test("estimateFromPools caps unsafe routes at 1000 bps", () => {
  const output = estimateFromPools(
    { amount_usd: 1_000_000 },
    [{ liquidity_usd: 10_000, volume_24h: 1_000, txns_24h: 5, volatility_pct: 20 }]
  );

  assert.equal(output.min_safe_slip_bps, 1000);
  assert.equal(output.confidence, "medium");
});

test("resolveAmountUsd derives notional value from token price when amount_usd is absent", () => {
  const amountUsd = resolveAmountUsd(
    {
      token_in: "0xbase",
      amount_in: "2.5"
    },
    [{
      base_token_address: "0xbase",
      token_price_usd: 3100
    }]
  );

  assert.equal(amountUsd, 7750);
});
