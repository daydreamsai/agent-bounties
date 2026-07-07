import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "lending-liquidation-sentinel",
  version: "1.0.0",
  description: "Monitor borrow positions and alert before liquidation. Tracks health factor, liquidation price, and buffer.",
});

// ===== Lending Pool & Position Simulation =====
// In production, this calls on-chain data from Aave, Compound, Morpho, etc.

interface LendingPoolConfig {
  name: string;
  asset: string;
  decimals: number;
  ltv: number;       // Loan-to-Value (e.g., 0.8 = 80%)
  liqThreshold: number; // Liquidation threshold (e.g., 0.85 = 85%)
}

const SUPPORTED_PROTOCOLS: Record<string, Record<string, LendingPoolConfig>> = {
  "aave-v3": {
    "ETH": { name: "Aave V3 ETH", asset: "ETH", decimals: 18, ltv: 0.80, liqThreshold: 0.83 },
    "WBTC": { name: "Aave V3 WBTC", asset: "WBTC", decimals: 8, ltv: 0.70, liqThreshold: 0.75 },
    "USDC": { name: "Aave V3 USDC", asset: "USDC", decimals: 6, ltv: 0.80, liqThreshold: 0.85 },
    "wstETH": { name: "Aave V3 wstETH", asset: "wstETH", decimals: 18, ltv: 0.72, liqThreshold: 0.78 },
    "LINK": { name: "Aave V3 LINK", asset: "LINK", decimals: 18, ltv: 0.50, liqThreshold: 0.65 },
  },
  "compound-v3": {
    "ETH": { name: "Compound V3 ETH", asset: "ETH", decimals: 18, ltv: 0.82, liqThreshold: 0.85 },
    "USDC": { name: "Compound V3 USDC", asset: "USDC", decimals: 6, ltv: 0.82, liqThreshold: 0.88 },
  },
};

// Mock oracle prices (in USD)
const MOCK_PRICES: Record<string, number> = {
  "ETH": 3200,
  "WBTC": 62500,
  "USDC": 1.00,
  "USDT": 1.00,
  "wstETH": 3480,
  "LINK": 14.50,
};

// Mock user positions
interface PositionState {
  collateralAmount: number;
  collateralAsset: string;
  borrowAmount: number;
  borrowAsset: string;
  healthFactor: number;
  liqPrice: number;
  bufferPercent: number;
}

function calculatePosition(
  protocol: string,
  poolId: string,
  collateralAmount: number,
  borrowAmount: number,
): PositionState {
  const protocolConfig = SUPPORTED_PROTOCOLS[protocol]?.[poolId];
  if (!protocolConfig) {
    return { collateralAmount, collateralAsset: poolId, borrowAmount, borrowAsset: poolId, healthFactor: 99, liqPrice: 0, bufferPercent: 999 };
  }

  const collateralPrice = MOCK_PRICES[poolId] || 100;
  const borrowPrice = MOCK_PRICES[protocolConfig.asset] || 100;

  const collateralValueUSD = collateralAmount * collateralPrice;
  const borrowValueUSD = borrowAmount * borrowPrice;

  if (borrowValueUSD === 0) {
    return { collateralAmount, collateralAsset: poolId, borrowAmount, borrowAsset: poolId, healthFactor: 99, liqPrice: 0, bufferPercent: 999 };
  }

  // Health Factor = (Collateral Value * Liq Threshold) / Borrow Value
  const healthFactor = (collateralValueUSD * protocolConfig.liqThreshold) / borrowValueUSD;

  // Liquidation Price = Borrow Value / (Collateral * Liq Threshold)
  const liqPrice = collateralAmount > 0
    ? borrowValueUSD / (collateralAmount * protocolConfig.liqThreshold)
    : 0;

  // Buffer % = (Health Factor - 1.0) * 100
  const bufferPercent = Math.round((healthFactor - 1.0) * 10000) / 100;

  return {
    collateralAmount: Math.round(collateralAmount * 10000) / 10000,
    collateralAsset: poolId,
    borrowAmount: Math.round(borrowAmount * 10000) / 10000,
    borrowAsset: poolId,
    healthFactor: Math.round(healthFactor * 100) / 100,
    liqPrice: Math.round(liqPrice * 100) / 100,
    bufferPercent,
  };
}

// ===== x402 Entrypoints =====

addEntrypoint({
  name: "check-positions",
  description: "Check health factor, liquidation price, and buffer for specified wallet positions",
  schema: z.object({
    wallet: z.string().describe("Wallet address to check"),
    protocol_ids: z.array(z.string()).describe("Protocols to query (e.g. aave-v3, compound-v3)"),
    positions: z.array(z.object({
      pool_id: z.string(),
      collateral_amount: z.number().positive(),
      borrow_amount: z.number().nonnegative(),
    })).describe("Positions to evaluate"),
  }),
  handler: async (input: { wallet: string; protocol_ids: string[]; positions: Array<{ pool_id: string; collateral_amount: number; borrow_amount: number }> }) => {
    const results: PositionState[] = [];

    for (const protocol of input.protocol_ids) {
      for (const pos of input.positions) {
        const state = calculatePosition(protocol, pos.pool_id, pos.collateral_amount, pos.borrow_amount);
        results.push(state);
      }
    }

    return {
      wallet: input.wallet,
      positions: results,
      timestamp: new Date().toISOString(),
    };
  },
});

addEntrypoint({
  name: "liquidation-alerts",
  description: "Check all positions and return only those that are near or at liquidation risk",
  schema: z.object({
    wallet: z.string(),
    protocol_ids: z.array(z.string()),
    positions: z.array(z.object({
      pool_id: z.string(),
      collateral_amount: z.number().positive(),
      borrow_amount: z.number().nonnegative(),
    })),
    alert_threshold: z.number().optional().default(1.5).describe("Alert when health factor drops below this value (default 1.5)"),
  }),
  handler: async (input: { wallet: string; protocol_ids: string[]; positions: Array<{ pool_id: string; collateral_amount: number; borrow_amount: number }>; alert_threshold: number }) => {
    const alerts: Array<PositionState & { alert_threshold_hit: boolean; severity: "safe" | "warning" | "critical" }> = [];

    for (const protocol of input.protocol_ids) {
      for (const pos of input.positions) {
        const state = calculatePosition(protocol, pos.pool_id, pos.collateral_amount, pos.borrow_amount);
        const thresholdHit = state.healthFactor < input.alert_threshold;
        const severity: "safe" | "warning" | "critical" = state.healthFactor < 1.05 ? "critical" : state.healthFactor < 1.2 ? "warning" : "safe";

        if (thresholdHit) {
          alerts.push({
            ...state,
            alert_threshold_hit: true,
            severity,
          });
        }
      }
    }

    return {
      wallet: input.wallet,
      alert_threshold: input.alert_threshold,
      alerts,
      alert_count: alerts.length,
      has_critical: alerts.some(a => a.severity === "critical"),
      timestamp: new Date().toISOString(),
    };
  },
});

export default app;
