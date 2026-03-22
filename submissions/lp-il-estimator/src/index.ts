/**
 * LP Impermanent Loss Estimator Agent
 *
 * Calculates IL%, fee earnings, and net P&L for LP positions.
 * Supports Uniswap v2/v3, Orca, Raydium, and any constant-product AMM.
 * Data sources: DefiLlama Yields API, CoinGecko price history.
 *
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

interface ILResult {
  pool_address: string;
  protocol: string;
  chain: string;
  pool_type: string;
  entry_price_ratio: number;
  current_price_ratio: number;
  IL_percent: number;
  il_explanation: string;
  fee_apr_est: number;
  reward_apr: number;
  total_apr: number;
  volume_window: number;
  hodl_value_usd: number;
  lp_value_usd: number;
  fee_earnings_usd: number;
  net_pnl_usd: number;
  annualized_il_pct: number;
  notes: string[];
}

interface SimScenario {
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
 * Constant product AMM (Uniswap v2 / Raydium CPMM / Orca v1) IL:
 *   IL = 2*sqrt(r) / (1+r) - 1
 * where r = current_price / entry_price
 */
function calcILv2(priceRatio: number): number {
  if (priceRatio <= 0) return 0;
  return (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1;
}

/**
 * Concentrated liquidity (Uniswap v3 / Orca Whirlpool / Raydium CLMM).
 * Amplifies IL based on position width. Out-of-range = fully single-sided.
 */
function calcILv3(
  priceRatio: number,
  lowerFrac: number,
  upperFrac: number
): number {
  if (priceRatio < lowerFrac || priceRatio > upperFrac) {
    // Out of range: fully single-sided, max exposure
    return calcILv2(priceRatio) * 2.0;
  }
  const rangeWidth = upperFrac - lowerFrac;
  const concentrationFactor = Math.min(1 + 1 / rangeWidth, 6);
  return calcILv2(priceRatio) * concentrationFactor;
}

function detectPoolType(project: string, poolMeta?: string): string {
  const p = (project + " " + (poolMeta ?? "")).toLowerCase();
  if (p.includes("v3") || p.includes("clmm") || p.includes("whirlpool") || p.includes("concentrated")) return "v3";
  if (p.includes("orca")) return "v2"; // Orca legacy = CPMM
  if (p.includes("raydium") && !p.includes("clmm")) return "v2";
  if (p.includes("uniswap") && !p.includes("v3")) return "v2";
  if (p.includes("v2") || p.includes("cpmm")) return "v2";
  return "v2"; // default to constant product
}

function ilExplanation(ilPct: number, feeApr: number, windowHours: number, annualILPct: number): string {
  const ilAbs = Math.abs(ilPct * 100).toFixed(2);
  if (Math.abs(ilPct) < 0.001) return "Negligible IL — prices nearly unchanged.";
  const severity =
    Math.abs(ilPct) < 0.02 ? "Minor" : Math.abs(ilPct) < 0.07 ? "Moderate" : "Significant";
  const profitable = feeApr > Math.abs(annualILPct) ? "Fees likely compensate IL." : "IL may exceed fee APR — review position.";
  return `${severity} IL of ${ilAbs}% over ${windowHours}h window. ${profitable}`;
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

let poolsCache: DefiLlamaPool[] | null = null;
let poolsCachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchDefiLlamaPools(): Promise<DefiLlamaPool[]> {
  if (poolsCache && Date.now() - poolsCachedAt < CACHE_TTL) return poolsCache;
  const res = await fetch("https://yields.llama.fi/pools", {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`DefiLlama API error: ${res.status}`);
  const data = (await res.json()) as { data: DefiLlamaPool[] };
  poolsCache = data.data ?? [];
  poolsCachedAt = Date.now();
  return poolsCache;
}

async function findPool(addr: string): Promise<DefiLlamaPool | null> {
  try {
    const pools = await fetchDefiLlamaPools();
    return pools.find((p) => p.pool.toLowerCase() === addr.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

async function fetchPriceHistory(tokenAddr: string, chain: string, days: number): Promise<number[]> {
  const cgChainMap: Record<string, string> = {
    ethereum: "ethereum",
    polygon: "polygon-pos",
    bsc: "binance-smart-chain",
    arbitrum: "arbitrum-one",
    optimism: "optimistic-ethereum",
    base: "base",
    avalanche: "avalanche",
    solana: "solana",
  };
  const platform = cgChainMap[chain.toLowerCase()] ?? "ethereum";
  try {
    const url =
      `https://api.coingecko.com/api/v3/coins/${platform}/contract/${tokenAddr}/market_chart/` +
      `?vs_currency=usd&days=${days}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { prices?: [number, number][] };
    return (data.prices ?? []).map(([, p]) => p);
  } catch {
    return [];
  }
}

// ─── Agent ────────────────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "lp-il-estimator",
  version: "1.0.0",
  description:
    "Calculate impermanent loss, fee APR, and net P&L for Uniswap v2/v3, Orca, and Raydium LP positions.",
});

// ── estimate_il ───────────────────────────────────────────────────────────────
addEntrypoint({
  key: "estimate_il",
  description:
    "Calculate IL%, fee APR, and net P&L for an LP position. Fetches live pool data from DefiLlama. Supports Uniswap v2/v3, Orca, Raydium.",
  input: z.object({
    pool_address: z
      .string()
      .describe("LP pool contract address or DefiLlama pool UUID"),
    token_weights: z
      .tuple([z.number(), z.number()])
      .default([50, 50])
      .describe("Token weight distribution [token0_pct, token1_pct], e.g. [50, 50]"),
    deposit_amounts: z
      .tuple([z.number(), z.number()])
      .default([0, 0])
      .describe("USD deposit per token [token0_usd, token1_usd]. Use [0,0] to skip P&L calc."),
    window_hours: z
      .number()
      .default(168)
      .describe("Historical window in hours (default 168 = 7 days)"),
    entry_price: z
      .number()
      .optional()
      .describe("Entry price of token0 in USD at deposit time"),
    current_price: z
      .number()
      .optional()
      .describe("Current price of token0 in USD"),
    fee_tier: z
      .number()
      .optional()
      .describe("Pool fee tier in bps, e.g. 30 for 0.3%, 5 for 0.05%"),
    price_ratio_override: z
      .number()
      .optional()
      .describe("Manual price ratio (current/entry). Skips on-chain price fetch if provided."),
    v3_range: z
      .object({
        lower_pct: z.number().describe("Lower tick as fraction of entry, e.g. 0.5 = -50%"),
        upper_pct: z.number().describe("Upper tick as fraction of entry, e.g. 2.0 = +100%"),
      })
      .optional()
      .describe("Concentrated liquidity range for v3 pools"),
  }),
  async handler({ input }) {
    const {
      pool_address,
      deposit_amounts,
      window_hours,
      entry_price,
      current_price,
      price_ratio_override,
      v3_range,
    } = input;

    const notes: string[] = [];
    const pool = await findPool(pool_address);

    // Determine price ratio
    let priceRatio: number;
    if (price_ratio_override !== undefined) {
      priceRatio = price_ratio_override;
      notes.push("Using provided price_ratio_override.");
    } else if (entry_price !== undefined && current_price !== undefined) {
      priceRatio = current_price / entry_price;
      notes.push(`Price ratio from entry/current: ${priceRatio.toFixed(4)}`);
    } else if (pool?.underlyingTokens?.[0]?.startsWith("0x")) {
      const chain = pool.chain.toLowerCase();
      const days = Math.max(1, Math.ceil(window_hours / 24));
      const prices = await fetchPriceHistory(pool.underlyingTokens[0], chain, days);
      if (prices.length >= 2) {
        priceRatio = prices[prices.length - 1] / prices[0];
        notes.push(
          `Token0 price change over ${window_hours}h: ${((priceRatio - 1) * 100).toFixed(2)}%`
        );
      } else {
        priceRatio = 1.0;
        notes.push("Price history unavailable — using ratio=1.0 (no IL shown).");
      }
    } else {
      priceRatio = 1.0;
      notes.push("No price data source available — provide entry_price/current_price or price_ratio_override.");
    }

    // Pool type detection
    const protocol = pool?.project ?? "unknown";
    const poolType = detectPoolType(protocol, pool?.poolMeta);

    // Calculate IL
    let ilFrac: number;
    if (poolType === "v3" && v3_range) {
      ilFrac = calcILv3(priceRatio, v3_range.lower_pct, v3_range.upper_pct);
    } else {
      ilFrac = calcILv2(priceRatio);
    }
    const IL_percent = +(ilFrac * 100).toFixed(4);

    // Fee data from DefiLlama
    const feeApr = pool?.apyBase ?? 0;
    const rewardApr = pool?.apyReward ?? 0;
    const totalApr = feeApr + rewardApr;
    const volumeWindow =
      pool?.volumeUsd7d !== undefined
        ? (pool.volumeUsd7d * window_hours) / (7 * 24)
        : 0;

    // P&L calculation
    const totalDeposit = deposit_amounts[0] + deposit_amounts[1];
    const annualizedILPct = (Math.abs(ilFrac) * (8760 / window_hours)) * 100;
    let hodlValueUsd = 0;
    let lpValueUsd = 0;
    let feeEarningsUsd = 0;
    let netPnlUsd = 0;

    if (totalDeposit > 0) {
      // HODL value: original deposit × price impact
      // For 50/50 pool: half in token0 (grows by priceRatio), half in token1 (stable)
      hodlValueUsd = deposit_amounts[0] * priceRatio + deposit_amounts[1];
      // LP value: IL shrinks the hodl value
      lpValueUsd = +(hodlValueUsd * (1 + ilFrac)).toFixed(2);
      hodlValueUsd = +hodlValueUsd.toFixed(2);
      // Fee earnings for the window
      feeEarningsUsd = +((totalDeposit * feeApr) / 100 * (window_hours / 8760)).toFixed(2);
      netPnlUsd = +(lpValueUsd + feeEarningsUsd - totalDeposit).toFixed(2);
    }

    if (feeApr > 0 && annualizedILPct > totalApr) {
      notes.push(`⚠️ Annualized IL (${annualizedILPct.toFixed(2)}%) exceeds total APR (${totalApr.toFixed(2)}%) — position may be losing.`);
    } else if (feeApr > 0) {
      notes.push(`Fees likely profitable: APR ${totalApr.toFixed(2)}% vs annualized IL ${annualizedILPct.toFixed(2)}%.`);
    }

    if (pool?.ilRisk === "high") notes.push("DefiLlama flags this pool as high IL risk.");

    const result: ILResult = {
      pool_address,
      protocol,
      chain: pool?.chain ?? "unknown",
      pool_type: poolType,
      entry_price_ratio: 1.0,
      current_price_ratio: +priceRatio.toFixed(6),
      IL_percent,
      il_explanation: ilExplanation(ilFrac, feeApr, window_hours, annualizedILPct),
      fee_apr_est: +feeApr.toFixed(2),
      reward_apr: +rewardApr.toFixed(2),
      total_apr: +totalApr.toFixed(2),
      volume_window: +volumeWindow.toFixed(0),
      hodl_value_usd: hodlValueUsd,
      lp_value_usd: lpValueUsd,
      fee_earnings_usd: feeEarningsUsd,
      net_pnl_usd: netPnlUsd,
      annualized_il_pct: +annualizedILPct.toFixed(2),
      notes,
    };

    return { output: result, usage: { total_tokens: 1 } };
  },
});

// ── simulate_il ───────────────────────────────────────────────────────────────
addEntrypoint({
  key: "simulate_il",
  description:
    "Batch-simulate IL across multiple price scenarios. No pool required — pure math.",
  input: z.object({
    price_changes: z
      .array(z.number())
      .default([0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0])
      .describe("List of price ratios (new/entry), e.g. [0.5, 1.5, 2.0]"),
    deposit_usd: z.number().default(10000).describe("Total deposit in USD"),
    fee_apr: z.number().default(10).describe("Annual fee APR percentage"),
    window_hours: z.number().default(168).describe("Holding window in hours"),
    pool_type: z
      .enum(["v2", "v3"])
      .default("v2")
      .describe("Pool type: v2 (constant product) or v3 (concentrated)"),
    v3_range: z
      .object({
        lower_pct: z.number(),
        upper_pct: z.number(),
      })
      .optional()
      .describe("v3 tick range fractions"),
  }),
  async handler({ input }) {
    const { price_changes, deposit_usd, fee_apr, window_hours, pool_type, v3_range } = input;
    const annualFeeIncome = (deposit_usd * fee_apr) / 100;
    const windowFeeIncome = (annualFeeIncome * window_hours) / 8760;

    const scenarios: SimScenario[] = price_changes.map((ratio) => {
      let ilFrac: number;
      if (pool_type === "v3" && v3_range) {
        ilFrac = calcILv3(ratio, v3_range.lower_pct, v3_range.upper_pct);
      } else {
        ilFrac = calcILv2(ratio);
      }
      const hodl = deposit_usd * ((ratio + 1) / 2); // 50/50 HODL value
      const lp = hodl * (1 + ilFrac);
      const ilLoss = lp - hodl;
      const netVsHodl = ilLoss + windowFeeIncome;
      return {
        price_ratio: ratio,
        price_change_pct: +((ratio - 1) * 100).toFixed(2),
        il_percent: +(ilFrac * 100).toFixed(4),
        hodl_value_usd: +hodl.toFixed(2),
        lp_value_usd: +lp.toFixed(2),
        il_loss_usd: +ilLoss.toFixed(2),
        annual_fee_income_usd: +annualFeeIncome.toFixed(2),
        net_vs_hodl: +netVsHodl.toFixed(2),
      };
    });

    return {
      output: {
        pool_type,
        deposit_usd,
        fee_apr,
        window_hours,
        scenarios,
        summary: `Simulated ${scenarios.length} price scenarios. Fee income over window: $${windowFeeIncome.toFixed(2)}.`,
      },
      usage: { total_tokens: scenarios.length },
    };
  },
});

// ── get_pool_metrics ──────────────────────────────────────────────────────────
addEntrypoint({
  key: "get_pool_metrics",
  description: "Fetch live APY, TVL, volume, and IL risk from DefiLlama for a pool.",
  input: z.object({
    pool_address: z.string().describe("Pool contract address or DefiLlama UUID"),
  }),
  async handler({ input }) {
    const pool = await findPool(input.pool_address);
    if (!pool) {
      return {
        output: { error: "Pool not found in DefiLlama", pool_address: input.pool_address },
        usage: { total_tokens: 1 },
      };
    }
    return {
      output: {
        pool_id: pool.pool,
        protocol: pool.project,
        chain: pool.chain,
        symbol: pool.symbol,
        tvl_usd: pool.tvlUsd ?? 0,
        apy: pool.apy ?? 0,
        fee_apr: pool.apyBase ?? 0,
        reward_apr: pool.apyReward ?? 0,
        volume_7d_usd: pool.volumeUsd7d ?? 0,
        il_risk: pool.ilRisk ?? "unknown",
        underlying_tokens: pool.underlyingTokens ?? [],
        pool_meta: pool.poolMeta ?? null,
      },
      usage: { total_tokens: 1 },
    };
  },
});

// ── echo ──────────────────────────────────────────────────────────────────────
addEntrypoint({
  key: "echo",
  description: "Health check — echoes input text.",
  input: z.object({ text: z.string() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "") },
      usage: { total_tokens: String(input.text ?? "").length },
    };
  },
});

// ─── Server ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 8093);
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`LP IL Estimator running on port ${PORT}`);
});

export default app;
