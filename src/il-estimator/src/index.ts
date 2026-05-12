/**
 * LP Impermanent Loss Estimator — DeFi IL and yield estimation agent.
 *
 * Estimates impermanent loss, fee APR, and volume for LP positions
 * across major AMMs using historical price and volume data.
 *
 * Entrypoints:
 *   - estimate-il: Compute IL and yield estimates for a pool position
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "lp-impermanent-loss-estimator",
  version: "0.1.0",
  description: "Estimate impermanent loss and yield for any LP position",
});

// ─── Shared Types ────────────────────────────────────────────────────────────

const AMMProtocol = z.enum([
  "uniswap-v2",
  "uniswap-v3",
  "curve",
  "balancer",
  "sushiswap",
  "camelot",
]);

const TokenWeight = z.object({
  address: z.string().describe("Token contract address"),
  symbol: z.string().optional().describe("Token symbol (e.g. ETH, USDC)"),
  weight: z.number().min(0).max(1).describe("Weight in the pool (0-1)"),
});

const DepositAmount = z.object({
  address: z.string().describe("Token contract address"),
  amount: z.string().describe("Deposit amount in wei/decimals"),
});

// ─── Internal Types ──────────────────────────────────────────────────────────

interface HistoricalSnapshot {
  priceA: number;
  priceB: number;
  volumeUsd: number;
  timestamp: number;
}

interface ILResult {
  poolAddress: string;
  ilPercent: number;
  feeAprEst: number;
  volumeWindow: number;
  notes: string[];
}

// ─── Mock Historical Data Store (replace with subgraph/RPC in production) ────

function generateMockHistory(
  windowHours: number,
  volatility: number = 0.05
): HistoricalSnapshot[] {
  const now = Date.now();
  const snapshots: HistoricalSnapshot[] = [];
  const count = Math.min(windowHours, 168); // cap at 1 week of hourly data

  let priceA = 1800 + Math.random() * 200; // e.g. ETH ~ 1800-2000
  let priceB = 1.0; // e.g. stablecoin

  for (let i = 0; i < count; i++) {
    const shock = (Math.random() - 0.5) * 2 * volatility;
    priceA = priceA * (1 + shock);
    const volBase = 1_000_000 + Math.random() * 10_000_000;

    snapshots.push({
      priceA: parseFloat(priceA.toFixed(4)),
      priceB,
      volumeUsd: parseFloat(volBase.toFixed(2)),
      timestamp: now - (count - i) * 3600_000,
    });
  }

  return snapshots;
}

/**
 * Calculate impermanent loss using the standard AMM formula.
 *
 * For a pool with two tokens at weights w1 and w2, given a price ratio
 * change from P0 to P1, impermanent loss is:
 *   IL = 2 * sqrt(k) / (1 + k) - 1  (for 50/50 weighted pools)
 *
 * Generalized for arbitrary weights:
 *   IL = (w1+k*w2) * (1/w1 + k^(-1)/w2)^(-1) - 1
 *
 * Where k = P1/P0 (price ratio change).
 */
function calculateImpermanentLoss(
  priceRatioChange: number,
  weightA: number,
  weightB: number
): number {
  // Generalized IL formula for constant product AMMs with weights
  const k = priceRatioChange;
  const w1 = weightA;
  const w2 = weightB;

  // Returns (w1 * k^(-w2) + w2 * k^w1) - 1  for generalized weights
  // Simplified: IL = (w1 * k^(-w2) + w2 * k^w1) - 1
  const termA = w1 * Math.pow(k, -w2);
  const termB = w2 * Math.pow(k, w1);
  const il = termA + termB - 1;

  return parseFloat((il * 100).toFixed(4));
}

/**
 * Estimate fee APR from historical volume and pool composition.
 */
function estimateFeeApr(
  volumeWindow: number,
  windowHours: number,
  depositUsd: number,
  feeRate: number = 0.003 // default 0.3% for UniV2-style
): number {
  if (depositUsd <= 0 || windowHours <= 0) return 0;

  // Proportion of LP share relative to total volume
  // Assume deposit is 0.1% of total pool liquidity for estimation
  const poolShare = 0.001;
  const annualizedVolume =
    (volumeWindow / windowHours) * 24 * 365;
  const feesCollected = annualizedVolume * feeRate * poolShare;
  const apr = (feesCollected / depositUsd) * 100;

  return parseFloat(apr.toFixed(2));
}

/**
 * Compute IL estimate by analyzing historical price series.
 */
async function estimateIL(
  poolAddress: string,
  weights: z.infer<typeof TokenWeight>[],
  depositAmounts: z.infer<typeof DepositAmount>[],
  windowHours: number
): Promise<ILResult> {
  // Fetch / generate historical price data
  const history = generateMockHistory(windowHours);

  if (history.length < 2) {
    return {
      poolAddress,
      ilPercent: 0,
      feeAprEst: 0,
      volumeWindow: 0,
      notes: ["Insufficient historical data to compute IL"],
    };
  }

  const entryPrice = history[0].priceA;
  const currentPrice = history[history.length - 1].priceA;
  const priceRatioChange =
    entryPrice > 0 ? currentPrice / entryPrice : 1;

  // Assume two major tokens for weight extraction
  const wA = weights.length >= 2 ? weights[0].weight : 0.5;
  const wB = weights.length >= 2 ? weights[1].weight : 0.5;

  const ilPercent = calculateImpermanentLoss(priceRatioChange, wA, wB);

  // Aggregate deposit USD value (mock prices)
  const totalDepositUsd = depositAmounts.reduce((sum, d, i) => {
    const mockPrice = i === 0 ? entryPrice : 1.0;
    const parsed = parseFloat(d.amount) / 1e18;
    return sum + parsed * mockPrice;
  }, 0);

  windowHours = Math.min(windowHours, history.length);
  const volumeWindow = history.reduce((sum, s) => sum + s.volumeUsd, 0);

  const feeAprEst = estimateFeeApr(
    volumeWindow,
    windowHours,
    totalDepositUsd
  );

  const notes: string[] = [];

  if (Math.abs(ilPercent) > 10) {
    notes.push(
      `High IL detected (${ilPercent.toFixed(2)}%). Consider narrow-range or stable pools.`
    );
  }
  if (feeAprEst > 50) {
    notes.push(
      `Fee APR of ${feeAprEst.toFixed(2)}% is above average — verify volume sustainability.`
    );
  }
  if (windowHours < 24) {
    notes.push(
      `Window of ${windowHours}h is short; estimates may not reflect long-term trends.`
    );
  }

  notes.push(
    "IL computed using generalized constant-product formula adjusted for token weights."
  );
  notes.push("Fee APR assumes 0.1% share of pool liquidity — adjust based on actual pool depth.");

  return {
    poolAddress,
    ilPercent,
    feeAprEst,
    volumeWindow: parseFloat(volumeWindow.toFixed(2)),
    notes,
  };
}

// ─── Entrypoint: estimate-il ─────────────────────────────────────────────────

addEntrypoint({
  key: "estimate-il",
  description:
    "Estimate impermanent loss and fee APR for an LP position given pool address, token weights, deposit amounts, and historical window",
  input: z.object({
    pool_address: z.string().describe("LP pool contract address"),
    token_weights: z
      .array(TokenWeight)
      .min(1)
      .max(8)
      .describe("Token weight distribution in the pool"),
    deposit_amounts: z
      .array(DepositAmount)
      .min(1)
      .max(8)
      .describe("Amount of each token being deposited"),
    window_hours: z
      .number()
      .int()
      .min(1)
      .max(8760)
      .describe("Historical window in hours for IL calculation"),
  }),
  output: z.object({
    IL_percent: z.number().describe("Impermanent loss percentage (negative = loss)"),
    fee_apr_est: z.number().describe("Estimated APR from trading fees"),
    volume_window: z.number().describe("Total trading volume in the window (USD)"),
    notes: z.array(z.string()).describe("Additional context, warnings, and methodology notes"),
  }),
  price: "500",
  async handler({ input }) {
    const result = await estimateIL(
      input.pool_address,
      input.token_weights,
      input.deposit_amounts,
      input.window_hours
    );

    return {
      output: {
        IL_percent: result.ilPercent,
        fee_apr_est: result.feeAprEst,
        volume_window: result.volumeWindow,
        notes: result.notes,
      },
      usage: { total_tokens: String(input.window_hours) },
    };
  },
});

export default app;
