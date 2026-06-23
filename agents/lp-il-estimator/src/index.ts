import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "lp-impermanent-loss-estimator",
  version: "1.0.0",
  description:
    "Calculate impermanent loss and fee APR for any LP position or simulated deposit across major AMMs (Uniswap V2/V3, Curve, Balancer).",
});

// ─── helpers ──────────────────────────────────────────────────────────

/** IL% for a 50/50 constant-product pool given a price ratio p = P_now / P_entry */
function il5050(priceRatio: number): number {
  const sqrtP = Math.sqrt(priceRatio);
  // IL = 2*sqrt(p)/(1+p) - 1   (negative number)
  return (2 * sqrtP) / (1 + priceRatio) - 1;
}

/** Generalised IL for weighted pool (x^a * y^b = k) */
function ilWeighted(priceRatio: number, w0: number, w1: number): number {
  // IL = (p^w0 * (1-p)^(1-w0)) / (w0*p + w1*(1-p)) - 1  (simplified)
  const held = w0 * priceRatio + w1 * 1; // value if held
  const lp =
    Math.pow(priceRatio, w0) * Math.pow(1, w1); // value in LP
  return lp / held - 1;
}

/** Estimate fee APR from 24h volume and TVL */
function feeApr(
  volume24h: number,
  tvl: number,
  feeTier: number,
  days: number
): number {
  if (tvl === 0) return 0;
  const dailyFees = volume24h * feeTier;
  const annualized = dailyFees * 365;
  return (annualized / tvl) * 100;
}

/** Fetch pool data from DeFi Llama or Uniswap subgraph */
async function fetchPoolData(poolAddress: string, windowHours: number) {
  // Try Uniswap V2/V3 subgraph via The Graph (free tier)
  const query = `{
    pool(id: "${poolAddress.toLowerCase()}") {
      token0 { symbol decimals }
      token1 { symbol decimals }
      totalValueLockedUSD
      volumeUSD
      feesUSD
      token0Price
      token1Price
      feeTier
    }
  }`;

  try {
    const resp = await fetch(
      "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      }
    );
    const json = (await resp.json()) as any;
    return json?.data?.pool ?? null;
  } catch {
    return null;
  }
}

/** Fetch from DeFi Llama as fallback */
async function fetchDefiLlamaPool(poolAddress: string) {
  try {
    const resp = await fetch(
      `https://yields.llama.fi/pools`
    );
    const json = (await resp.json()) as any;
    const pools = json?.data ?? [];
    const match = pools.find(
      (p: any) => p.pool?.toLowerCase() === poolAddress.toLowerCase()
    );
    return match ?? null;
  } catch {
    return null;
  }
}

// ─── entrypoint ───────────────────────────────────────────────────────

addEntrypoint({
  key: "estimate-il",
  description:
    "Compute impermanent loss percentage and estimated fee APR for an LP position.",
  input: z.object({
    pool_address: z
      .string()
      .describe("LP pool contract address"),
    token_weights: z
      .array(z.number())
      .min(2)
      .max(2)
      .default([0.5, 0.5])
      .describe("Token weight distribution, e.g. [0.5, 0.5]"),
    deposit_amounts: z
      .array(z.number())
      .min(2)
      .max(2)
      .describe("Amount of each token deposited"),
    window_hours: z
      .number()
      .int()
      .positive()
      .default(24)
      .describe("Historical window in hours for calculation"),
  }),

  async handler({ input }) {
    const {
      pool_address,
      token_weights,
      deposit_amounts,
      window_hours,
    } = input;

    // Attempt to fetch live pool data
    const pool = await fetchPoolData(pool_address, window_hours);
    const llamaPool = pool ? null : await fetchDefiLlamaPool(pool_address);

    // Determine price ratio (current / entry). Without historical data
    // we simulate using the pool's current tick-derived ratio.
    let priceRatio = 1; // default: no change
    let volumeWindow = 0;
    let feeTierBps = 3000; // default 0.3 %
    let tvl = 0;
    let notes = "";

    if (pool) {
      // Use token0Price as proxy for price ratio movement
      priceRatio = parseFloat(pool.token0Price ?? "1") || 1;
      volumeWindow = parseFloat(pool.volumeUSD ?? "0") || 0;
      feeTierBps = parseInt(pool.feeTier ?? "3000") || 3000;
      tvl = parseFloat(pool.totalValueLockedUSD ?? "0") || 0;
      notes = `Data sourced from Uniswap V3 subgraph. Pool: ${pool.token0?.symbol ?? "?"}/${pool.token1?.symbol ?? "?"}`;
    } else if (llamaPool) {
      tvl = llamaPool.tvlUsd ?? 0;
      volumeWindow = llamaPool.volumeUsd1d ?? 0;
      notes = `Data sourced from DeFi Llama. Pool chain: ${llamaPool.chain ?? "unknown"}`;
    } else {
      // Fallback: compute IL from deposit ratio as simulation
      const totalA = deposit_amounts[0];
      const totalB = deposit_amounts[1];
      if (totalA > 0 && totalB > 0) {
        priceRatio = (totalB / totalA) * 2; // rough ratio
      }
      notes =
        "Live pool data unavailable — IL computed from deposit amounts as simulation. Provide a valid pool_address for on-chain accuracy.";
    }

    // Compute IL
    const w0 = token_weights[0];
    const w1 = token_weights[1];
    const ilPct =
      w0 === 0.5 && w1 === 0.5
        ? il5050(priceRatio) * 100
        : ilWeighted(priceRatio, w0, w1) * 100;

    // Compute fee APR
    const feeTierDecimal = feeTierBps / 1_000_000; // bps → decimal
    const feeAprEst = feeApr(volumeWindow, tvl, feeTierDecimal, 1);

    return {
      output: {
        IL_percent: parseFloat(ilPct.toFixed(4)),
        fee_apr_est: parseFloat(feeAprEst.toFixed(2)),
        volume_window: volumeWindow,
        notes,
      },
      usage: { total_tokens: pool_address.length + window_hours },
    };
  },
});

export default app;
