/**
 * LP Impermanent Loss Estimator Agent
 *
 * Calculates impermanent loss and fee APR estimates for Uniswap V2/V3 LP positions.
 *
 * Entrypoints:
 *   - estimate: Full IL + fee APR calculation
 *   - il-only: Quick IL calculation only
 *   - price-analysis: Price ratio analysis
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import {
  calculateImpermanentLoss,
  estimateFeeApr,
  analyzePriceRatio,
  generateNotes,
  calcNetPnL,
} from "./il-calculator.js";
import type {
  EstimateInput,
  EstimateOutput,
  ILParams,
  FeeAprParams,
  PriceAnalysis,
} from "./types.js";

const { app, addEntrypoint } = createAgentApp({
  name: "lp-impermanent-loss-estimator",
  version: "0.1.0",
  description:
    "Calculate impermanent loss and fee APR for any Uniswap V2/V3 LP position",
});

// ─── Estimate Entrypoint ────────────────────────────────────────────

const estimateInputSchema = z.object({
  pool_address: z.string().describe("LP pool address"),
  amm_type: z
    .enum(["uniswap_v2", "uniswap_v3"])
    .default("uniswap_v2")
    .describe("AMM type: uniswap_v2 or uniswap_v3"),
  deposit_amounts: z
    .tuple([z.string(), z.string()])
    .describe("Amount of token0 and token1 deposited"),
  token_weights: z
    .tuple([z.number(), z.number()])
    .optional()
    .describe("Token weight distribution [weight0, weight1]"),
  window_hours: z
    .number()
    .default(24)
    .describe("Historical window in hours for volume/fee calculation"),
  price_range: z
    .tuple([z.number(), z.number()])
    .optional()
    .describe("V3: price range as [lower, upper]"),
  current_price: z
    .number()
    .optional()
    .describe("Current price of token0 in terms of token1"),
  entry_price: z
    .number()
    .optional()
    .describe("Entry price of token0 when position was opened"),
  fee_tier_bps: z
    .number()
    .default(30)
    .describe("Pool fee tier in basis points (e.g. 30 = 0.3%)"),
  tvl_entry: z
    .number()
    .optional()
    .describe("Pool TVL at entry time (USD)"),
  tvl_current: z
    .number()
    .optional()
    .describe("Current pool TVL (USD)"),
  volume_window: z
    .number()
    .optional()
    .describe("Trading volume in the window (USD)"),
});

addEntrypoint({
  key: "estimate",
  description:
    "Calculate impermanent loss, fee APR, and P&L for an LP position",
  input: estimateInputSchema,
  async handler({ input }) {
    const i = input as z.infer<typeof estimateInputSchema>;

    // ── Parse inputs ──────────────────────────────────────
    const ammType = (i.amm_type || "uniswap_v2") as "uniswap_v2" | "uniswap_v3";
    const windowHours = i.window_hours || 24;
    const feeTierBps = i.fee_tier_bps || 30;

    const currentPrice = i.current_price ?? 1;
    const entryPrice = i.entry_price ?? 1;
    const priceRatio = entryPrice > 0 ? currentPrice / entryPrice : 1;

    const volumeWindow = i.volume_window ?? 0;
    const tvlCurrent = i.tvl_current ?? 0;

    // ── Price analysis ────────────────────────────────────
    const priceAnalysis = analyzePriceRatio(currentPrice, entryPrice);

    // ── Impermanent loss ──────────────────────────────────
    const ilParams: ILParams = {
      ammType,
      priceRatio,
      tokenWeights: i.token_weights,
      priceRange: i.price_range,
    };
    const ilDecimal = calculateImpermanentLoss(ilParams);
    const ilPercent = ilDecimal * 100;

    // ── Fee APR estimation ────────────────────────────────
    let feeAprEst = 0;
    if (tvlCurrent > 0 && volumeWindow > 0) {
      const feeParams: FeeAprParams = {
        feeTierBps,
        volumeWindow,
        tvlCurrent,
        windowHours,
      };
      feeAprEst = estimateFeeApr(feeParams);
    }

    // ── Net P&L ───────────────────────────────────────────
    const netPnlPercent = calcNetPnL(ilDecimal, feeAprEst, windowHours) * 100;

    // ── Notes ─────────────────────────────────────────────
    const notes = generateNotes(ilPercent, feeAprEst, priceAnalysis, ammType);

    // Always add position profit note
    const positionInProfit = priceRatio > 1;

    const output: EstimateOutput = {
      il_percent: parseFloat(ilPercent.toFixed(4)),
      fee_apr_est: parseFloat((feeAprEst * 100).toFixed(4)),
      volume_window: volumeWindow,
      price_ratio: parseFloat(priceRatio.toFixed(6)),
      net_pnl_percent: parseFloat(netPnlPercent.toFixed(4)),
      position_in_profit: positionInProfit,
      notes,
    };

    return {
      output,
      usage: {
        total_tokens: 1,
      },
    };
  },
});

// ─── IL-Only Entrypoint ──────────────────────────────────────────────

const ilOnlyInputSchema = z.object({
  amm_type: z
    .enum(["uniswap_v2", "uniswap_v3"])
    .default("uniswap_v2")
    .describe("AMM type"),
  price_ratio: z
    .number()
    .positive()
    .describe("Current price / entry price ratio"),
  price_range: z
    .tuple([z.number(), z.number()])
    .optional()
    .describe("V3: [lower, upper] price range"),
});

addEntrypoint({
  key: "il-only",
  description:
    "Quick impermanent loss calculation from price ratio (no volume/fee data needed)",
  input: ilOnlyInputSchema,
  async handler({ input }) {
    const i = input as z.infer<typeof ilOnlyInputSchema>;

    const ilParams: ILParams = {
      ammType: i.amm_type as "uniswap_v2" | "uniswap_v3",
      priceRatio: i.price_ratio,
      priceRange: i.price_range,
    };
    const ilDecimal = calculateImpermanentLoss(ilParams);
    const ilPercent = ilDecimal * 100;

    return {
      output: {
        il_percent: parseFloat(ilPercent.toFixed(4)),
        il_decimal: parseFloat(ilDecimal.toFixed(6)),
        price_ratio: i.price_ratio,
        amm_type: i.amm_type,
      },
      usage: {
        total_tokens: 1,
      },
    };
  },
});

// ─── Price Analysis Entrypoint ───────────────────────────────────────

const priceAnalysisInputSchema = z.object({
  current_price: z.number().positive().describe("Current token0/token1 price"),
  entry_price: z.number().positive().describe("Entry price when position opened"),
});

addEntrypoint({
  key: "price-analysis",
  description:
    "Analyze price ratio deviation between current and entry price",
  input: priceAnalysisInputSchema,
  async handler({ input }) {
    const i = input as z.infer<typeof priceAnalysisInputSchema>;

    const analysis: PriceAnalysis = analyzePriceRatio(
      i.current_price,
      i.entry_price
    );

    return {
      output: {
        price_ratio: parseFloat(analysis.ratio.toFixed(6)),
        deviation_percent: parseFloat(
          analysis.deviationPercent.toFixed(2)
        ),
        direction: analysis.direction,
        severity: analysis.severity,
        current_price: i.current_price,
        entry_price: i.entry_price,
      },
      usage: {
        total_tokens: 1,
      },
    };
  },
});

export default app;
