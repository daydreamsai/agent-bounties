/**
 * LP Impermanent Loss Estimator Agent
 *
 * Calculate IL and fee APR for any LP position or simulated deposit.
 * Uses DefiLlama pools API and CoinGecko for price history.
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/7
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DefiLlamaPool {
  pool: string;
  project: string;
  chain: string;
  symbol: string;
  underlyingTokens?: string[];
  tvlUsd?: number;
  apy?: number;
  apyBase?: number;
  apyReward?: number;
  volumeUsd7d?: number;
  ilRisk?: string;
  poolMeta?: string;
}

interface PoolMetrics {
  pool_id: string;
  protocol: string;
  chain: string;
  symbol: string;
  tvl_usd: number;
  apy: number;
  fee_apr: number;
  reward_apr: number;
  volume_7d_usd: number;
  il_risk: string;
  underlying_tokens: string[];
}

interface ILScenario {
  price_ratio: number;
  price_change_pct: number;
  il_percent: number;
  hodl_value_usd: number;
  lp_value_usd: number;
  il_loss_usd: number;
  annual_fee_income_usd: number;
  net_vs_hodl: number;
}

// ─── IL Math ──────────────────────────────────────────────────────────────────

/**
 * Constant product AMM (v2) IL formula:
 * IL = 2*sqrt(r) / (1+r) - 1, where r = new_price / entry_price
 */
function calcILv2(priceRatio: number): number {
  if (priceRatio <= 0) return 0;
  return (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1;
}

/**
 * Concentrated liquidity (v3) — simplified approximation.
 * If price exits range, IL is amplified significantly.
 * rangeFactor = tickRange / entryPrice (width as fraction of price)
 */
function calcILv3(priceRatio: number, lowerFrac: number, upperFrac: number): number {
  const lower = lowerFrac; // e.g. 0.5 = -50% below entry
  const upper = upperFrac; // e.g. 2.0 = +100% above entry
  if (priceRatio < lower || priceRatio > upper) {
    // Out of range: fully single-sided, maximum IL
    return calcILv2(priceRatio) * 2.0;
  }
  const rangeWidth = upper - lower;
  const concentrationFactor = Math.min(1 + 1 / rangeWidth, 5);
  return calcILv2(priceRatio) * concentrationFactor;
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

let poolsCache: DefiLlamaPool[] | null = null;
let poolsCachedAt = 0;

async function fetchDefiLlamaPools(): Promise<DefiLlamaPool[]> {
  if (poolsCache && Date.now() - poolsCachedAt < 5 * 60 * 1000) {
    return poolsCache;
  }
  const res = await fetch("https://yields.llama.fi/pools", {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`DefiLlama API error: ${res.status}`);
  const data = await res.json() as { data: DefiLlamaPool[] };
  poolsCache = data.data || [];
  poolsCachedAt = Date.now();
  return poolsCache;
}

async function findPool(poolAddress: string): Promise<DefiLlamaPool | null> {
  try {
    const pools = await fetchDefiLlamaPools();
    return pools.find((p) => p.pool.toLowerCase() === poolAddress.toLowerCase()) || null;
  } catch {
    return null;
  }
}

async function fetchTokenPriceHistory(
  tokenAddress: string,
  chain: string,
  days: number
): Promise<number[]> {
  const cgChain: Record<string, string> = {
    ethereum: "ethereum",
    polygon: "polygon-pos",
    bsc: "binance-smart-chain",
    arbitrum: "arbitrum-one",
    optimism: "optimistic-ethereum",
    base: "base",
    avalanche: "avalanche",
  };
  const platform = cgChain[chain.toLowerCase()] || "ethereum";

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${platform}/contract/${tokenAddress}/market_chart/?vs_currency=usd&days=${days}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as { prices?: [number, number][] };
    return (data.prices || []).map(([, p]) => p);
  } catch {
    return [];
  }
}

// ─── Agent App ────────────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "lp-il-estimator",
  version: "1.0.0",
  description: "Calculate impermanent loss and fee APR for any LP position. Uses DefiLlama pool data and CoinGecko price history.",
});

addEntrypoint({
  key: "estimate_il",
  description:
    "Calculate impermanent loss and fee APR for a real LP position. Fetches pool data from DefiLlama and price history from CoinGecko.",
  input: z.object({
    pool_address: z.string().describe("LP pool address or DefiLlama pool ID (e.g. '0x...' or UUID)"),
    token_weights: z
      .tuple([z.number(), z.number()])
      .default([50, 50])
      .describe("Token weight distribution [token0_pct, token1_pct] e.g. [50, 50]"),
    deposit_amounts: z
      .tuple([z.number(), z.number()])
      .default([0, 0])
      .describe("Deposit in USD [token0_usd, token1_usd]. Set [0,0] to skip PnL calculation."),
    window_hours: z
      .number()
      .default(168)
      .describe("Historical window in hours (default 168 = 7 days)"),
    price_ratio_override: z
      .number()
      .optional()
      .describe("Manual price ratio override (new_price/entry_price). E.g. 2.0 = token0 doubled. Skips on-chain price fetch."),
  }),
  async handler({ input }) {
    const { pool_address, token_weights, deposit_amounts, window_hours, price_ratio_override } = input;

    const pool = await findPool(pool_address);
    const notes: string[] = [];

    // Determine price ratio
    let priceRatio = price_ratio_override || 1.0;

    if (!price_ratio_override && pool?.underlyingTokens?.[0]?.startsWith("0x")) {
      const chain = pool.chain.toLowerCase();
      const days = Math.max(1, Math.ceil(window_hours / 24));
      const prices = await fetchTokenPriceHistory(pool.underlyingTokens[0], chain, days);
      if (prices.length >= 2) {
        priceRatio = prices[prices.length - 1] / prices[0];
        notes.push(`Token0 price change over ${window_hours}h: ${((priceRatio - 1) * 100).toFixed(2)}%`);
      } else {
        notes.push("Price history unavailable — using priceRatio=1.0 (no IL)");
      }
    }

    // Determine pool type
    const protocol = pool?.project?.toLowerCase() || "";
    const isConcentrated =
      protocol.includes("v3") ||
      protocol.includes("concentrated") ||
      protocol.includes("algebra");

    // Calculate IL
    const ilFraction = isConcentrated
      ? calcILv3(priceRatio, 0.5, 2.0)
      : calcILv2(priceRatio);

    const ilPercent = ilFraction * 100;

    if (isConcentrated) notes.push("Concentrated liquidity — IL amplified by position range");

    // Position PnL
    const totalDeposit = deposit_amounts[0] + deposit_amounts[1];
    const wTotal = token_weights[0] + token_weights[1];
    const w0 = wTotal > 0 ? token_weights[0] / wTotal : 0.5;
    const w1 = wTotal > 0 ? token_weights[1] / wTotal : 0.5;
    const hodlValue = totalDeposit > 0 ? totalDeposit * (w0 * priceRatio + w1) : null;
    const lpValue = hodlValue !== null ? hodlValue * (1 + ilFraction) : null;
    const netPnl = lpValue !== null && hodlValue !== null ? lpValue - totalDeposit : null;

    // APR data from DefiLlama
    const feeApr = pool?.apyBase || 0;
    const rewardApr = pool?.apyReward || 0;
    const totalApr = pool?.apy || feeApr + rewardApr;
    const volumeWindow = pool?.volumeUsd7d
      ? (pool.volumeUsd7d / 7) * (window_hours / 24)
      : 0;

    // IL explanation
    const absIL = Math.abs(ilPercent);
    let ilExplanation: string;
    if (absIL < 0.5) ilExplanation = "Minimal IL — prices moved little. LP nearly equivalent to holding.";
    else if (absIL < 5) ilExplanation = `Low IL of ${absIL.toFixed(2)}% — fees (${feeApr.toFixed(1)}% APR) likely cover the divergence.`;
    else if (absIL < 20) ilExplanation = `Moderate IL of ${absIL.toFixed(2)}% — evaluate if fee APR (${feeApr.toFixed(1)}%) compensates.`;
    else ilExplanation = `High IL of ${absIL.toFixed(2)}% — significant divergence loss. Consider removing liquidity.`;

    if (totalApr > 0 && absIL > 0 && window_hours > 0) {
      const annualizedIL = absIL * (8760 / window_hours);
      if (annualizedIL > totalApr) {
        notes.push(`WARNING: Annualized IL (${annualizedIL.toFixed(1)}%) > total APR (${totalApr.toFixed(1)}%) — LP may be unprofitable`);
      } else {
        notes.push(`Fees likely profitable: APR ${totalApr.toFixed(1)}% vs annualized IL ${annualizedIL.toFixed(1)}%`);
      }
    }
    if (pool?.ilRisk === "yes" || pool?.ilRisk === "high") {
      notes.push("DefiLlama flags this pool as HIGH IL risk");
    }
    if (!pool) notes.push("Pool not found in DefiLlama — using provided parameters");

    return {
      output: {
        pool_address,
        token0: pool?.underlyingTokens?.[0] || "token0",
        token1: pool?.underlyingTokens?.[1] || "token1",
        protocol: pool?.project || "unknown",
        chain: pool?.chain || "unknown",
        IL_percent: parseFloat(ilPercent.toFixed(4)),
        il_explanation: ilExplanation,
        fee_apr_est: parseFloat(feeApr.toFixed(4)),
        reward_apr: parseFloat(rewardApr.toFixed(4)),
        total_apr: parseFloat(totalApr.toFixed(4)),
        volume_window: parseFloat(volumeWindow.toFixed(2)),
        price_ratio_used: parseFloat(priceRatio.toFixed(6)),
        hodl_value_usd: hodlValue !== null ? parseFloat(hodlValue.toFixed(2)) : null,
        lp_value_usd: lpValue !== null ? parseFloat(lpValue.toFixed(2)) : null,
        net_pnl_usd: netPnl !== null ? parseFloat(netPnl.toFixed(2)) : null,
        notes,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: "1" },
    };
  },
});

addEntrypoint({
  key: "simulate_il",
  description: "Simulate impermanent loss across multiple price scenarios. No pool address required.",
  input: z.object({
    price_changes: z
      .array(z.number())
      .default([0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 5.0])
      .describe("Array of price ratios to simulate (e.g. 0.5 = -50%, 2.0 = +100%)"),
    deposit_usd: z.number().default(10000).describe("Total deposit in USD"),
    fee_apr: z.number().default(10).describe("Annual fee APR % for net return estimate"),
    pool_type: z
      .enum(["v2", "v3"])
      .default("v2")
      .describe("v2 = constant product AMM, v3 = concentrated liquidity (approximate)"),
    window_days: z.number().default(30).describe("Time window in days for fee income calculation"),
  }),
  async handler({ input }) {
    const { price_changes, deposit_usd, fee_apr, pool_type, window_days } = input;

    const scenarios: ILScenario[] = price_changes.map((ratio) => {
      const ilFraction = pool_type === "v3" ? calcILv3(ratio, 0.5, 2.0) : calcILv2(ratio);
      const ilPercent = ilFraction * 100;
      const hodlValue = deposit_usd * (0.5 * ratio + 0.5);
      const lpValue = hodlValue * (1 + ilFraction);
      const feeIncome = deposit_usd * (fee_apr / 100) * (window_days / 365);

      return {
        price_ratio: ratio,
        price_change_pct: parseFloat(((ratio - 1) * 100).toFixed(1)),
        il_percent: parseFloat(ilPercent.toFixed(3)),
        hodl_value_usd: parseFloat(hodlValue.toFixed(2)),
        lp_value_usd: parseFloat(lpValue.toFixed(2)),
        il_loss_usd: parseFloat((hodlValue - lpValue).toFixed(2)),
        annual_fee_income_usd: parseFloat(feeIncome.toFixed(2)),
        net_vs_hodl: parseFloat((lpValue + feeIncome - hodlValue).toFixed(2)),
      };
    });

    // IL at 2x = classic reference point
    const il2x = Math.abs(calcILv2(2) * 100);

    return {
      output: {
        pool_type,
        deposit_usd,
        fee_apr,
        window_days,
        scenarios,
        reference: {
          il_at_2x_price: parseFloat(il2x.toFixed(3)),
          il_at_5x_price: parseFloat(Math.abs(calcILv2(5) * 100).toFixed(3)),
          breakeven_fee_apr_for_2x_move: parseFloat(il2x.toFixed(3)),
        },
        formula: pool_type === "v2"
          ? "IL = 2*sqrt(r)/(1+r) - 1"
          : "Concentrated: IL amplified by concentration factor when in range, 2x amplification when out of range",
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: String(price_changes.length) },
    };
  },
});

addEntrypoint({
  key: "get_pool_metrics",
  description: "Fetch live pool metrics from DefiLlama — APY, TVL, volume, IL risk rating",
  input: z.object({
    pool_address: z.string().describe("Pool address or DefiLlama pool UUID"),
    top_n: z
      .number()
      .default(1)
      .describe("If pool not found by address, return top N pools by TVL matching symbol"),
  }),
  async handler({ input }) {
    const { pool_address } = input;
    const pool = await findPool(pool_address);
    if (!pool) {
      throw new Error(`Pool ${pool_address} not found in DefiLlama. Check the address or use the DefiLlama pool UUID.`);
    }

    const metrics: PoolMetrics = {
      pool_id: pool.pool,
      protocol: pool.project,
      chain: pool.chain,
      symbol: pool.symbol,
      tvl_usd: pool.tvlUsd || 0,
      apy: pool.apy || 0,
      fee_apr: pool.apyBase || 0,
      reward_apr: pool.apyReward || 0,
      volume_7d_usd: pool.volumeUsd7d || 0,
      il_risk: pool.ilRisk || "unknown",
      underlying_tokens: pool.underlyingTokens || [],
    };

    return {
      output: {
        ...metrics,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: "1" },
    };
  },
});

addEntrypoint({
  key: "echo",
  description: "Health check",
  input: z.object({ text: z.string().optional() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "lp-il-estimator online") },
      usage: { total_tokens: "1" },
    };
  },
});

const PORT = parseInt(process.env.PORT ?? "8093");
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`LP IL Estimator running on http://0.0.0.0:${info.port}`);
});

export default app;
