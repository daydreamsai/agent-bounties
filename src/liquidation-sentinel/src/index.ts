/**
 * Lending Liquidation Sentinel — DeFi liquidation risk monitoring agent.
 *
 * Watches borrow positions across lending protocols and fires alerts
 * when health factors approach the liquidation threshold.
 *
 * Entrypoints:
 *   - check-positions: Evaluate one or more borrow positions and return
 *     health factor, liquidation price, safety buffer, and alert status.
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "lending-liquidation-sentinel",
  version: "0.1.0",
  description: "Watch borrow positions and warn before liquidation risk",
});

// ─── Shared Types ────────────────────────────────────────────────────────────

const ProtocolId = z.enum([
  "aave-v3",
  "compound-v3",
  "morpho",
  "spark",
  "radiant",
  "silo",
]);

const CollateralAsset = z.object({
  asset: z.string().describe("Collateral token address or symbol"),
  amount: z.string().describe("Collateral amount (human-readable)"),
  priceUsd: z.number().positive().describe("Current USD price of collateral"),
});

const DebtAsset = z.object({
  asset: z.string().describe("Debt token address or symbol"),
  amount: z.string().describe("Debt amount (human-readable)"),
  priceUsd: z.number().positive().describe("Current USD price of debt token"),
});

const Position = z.object({
  id: z.string().describe("Unique position identifier"),
  protocol: ProtocolId,
  chain: z.string().describe("Chain name (e.g. ethereum, arbitrum, polygon)"),
  collateral: z.array(CollateralAsset).min(1),
  debt: z.array(DebtAsset).min(1),
  ltv: z
    .number()
    .min(0)
    .max(1)
    .describe("Loan-to-value ratio set by protocol"),
});

// ─── Internal Types ──────────────────────────────────────────────────────────

interface PositionSnapshot {
  positionId: string;
  protocol: string;
  chain: string;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  ltv: number;
  liqThreshold: number;
  healthFactor: number;
  liqPriceUsd: number;
  bufferPercent: number;
  alertThresholdHit: boolean;
  timestamp: number;
}

interface LiquidationAlert {
  positionId: string;
  protocol: string;
  chain: string;
  healthFactor: number;
  liqPriceUsd: number;
  bufferPercent: number;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const LIQUIDATION_HF = 1.0;
const WARN_HF = 1.2;
const INFO_HF = 1.5;

// ─── Mock Data Store (replace with real onchain indexing in production) ──────

let lastSnapshots: Map<string, PositionSnapshot> = new Map();

/**
 * Derive a composite liquidation threshold from protocol & LTV.
 * In production: read the actual liquidation threshold from the protocol's
 * reserve config (e.g. Aave's liquidationThreshold).
 */
function deriveLiqThreshold(protocol: string, ltv: number): number {
  switch (protocol) {
    case "aave-v3":
      return Math.min(ltv * 1.25, 0.95);
    case "compound-v3":
      return Math.min(ltv * 1.2, 0.9);
    case "morpho":
      return Math.min(ltv * 1.15, 0.98);
    default:
      return Math.min(ltv * 1.2, 0.95);
  }
}

/**
 * Evaluate a single borrow position.
 * In production: fetch live onchain data (price oracles, reserve state, user
 * account data) via RPC or subgraph calls.
 */
async function evaluatePosition(
  position: z.infer<typeof Position>
): Promise<{ snapshot: PositionSnapshot; alert: LiquidationAlert | null }> {
  const totalCollateralUsd = position.collateral.reduce(
    (sum, c) => sum + parseFloat(c.amount) * c.priceUsd,
    0
  );
  const totalDebtUsd = position.debt.reduce(
    (sum, d) => sum + parseFloat(d.amount) * d.priceUsd,
    0
  );
  const liqThreshold = deriveLiqThreshold(position.protocol, position.ltv);
  const maxDebtAllowed = totalCollateralUsd * liqThreshold;
  const healthFactor =
    totalDebtUsd > 0 ? maxDebtAllowed / totalDebtUsd : Infinity;

  // Liquidation price = the collateral price at which HF = 1
  // For a single-collateral position: liqPrice = (debt / ltv) / collateralAmount
  const primaryCollateral = position.collateral[0];
  const collAmount = parseFloat(primaryCollateral.amount);
  const liqPriceUsd =
    collAmount > 0
      ? parseFloat(
          (
            totalDebtUsd /
            liqThreshold /
            collAmount
          ).toFixed(6)
        )
      : 0;

  const bufferPercent = parseFloat(
    (healthFactor === Infinity
      ? 100
      : ((healthFactor - LIQUIDATION_HF) / LIQUIDATION_HF) * 100
    ).toFixed(2)
  );
  const alertThresholdHit = healthFactor < WARN_HF;

  const snapshot: PositionSnapshot = {
    positionId: position.id,
    protocol: position.protocol,
    chain: position.chain,
    totalCollateralUsd,
    totalDebtUsd,
    ltv: position.ltv,
    liqThreshold,
    healthFactor: parseFloat(healthFactor.toFixed(4)),
    liqPriceUsd,
    bufferPercent,
    alertThresholdHit,
    timestamp: Date.now(),
  };

  let alert: LiquidationAlert | null = null;

  if (healthFactor <= LIQUIDATION_HF) {
    alert = {
      positionId: position.id,
      protocol: position.protocol,
      chain: position.chain,
      healthFactor: snapshot.healthFactor,
      liqPriceUsd,
      bufferPercent,
      severity: "critical",
      message: `Position ${position.id} is at liquidation risk! Health factor is ${snapshot.healthFactor} (below ${LIQUIDATION_HF}).`,
      timestamp: Date.now(),
    };
  } else if (healthFactor < WARN_HF) {
    alert = {
      positionId: position.id,
      protocol: position.protocol,
      chain: position.chain,
      healthFactor: snapshot.healthFactor,
      liqPriceUsd,
      bufferPercent,
      severity: "warning",
      message: `Position ${position.id} is approaching liquidation. Health factor ${snapshot.healthFactor} (buffer: ${bufferPercent}%).`,
      timestamp: Date.now(),
    };
  } else if (healthFactor < INFO_HF) {
    alert = {
      positionId: position.id,
      protocol: position.protocol,
      chain: position.chain,
      healthFactor: snapshot.healthFactor,
      liqPriceUsd,
      bufferPercent,
      severity: "info",
      message: `Position ${position.id} health factor is ${snapshot.healthFactor} (buffer: ${bufferPercent}%).`,
      timestamp: Date.now(),
    };
  }

  return { snapshot, alert };
}

// ─── Entrypoint: check-positions ────────────────────────────────────────────

addEntrypoint({
  key: "check-positions",
  description:
    "Evaluate one or more borrow positions across lending protocols and return health metrics + alerts",
  input: z.object({
    wallet: z.string().describe("Wallet address to monitor"),
    protocol_ids: z
      .array(ProtocolId)
      .min(1)
      .max(20)
      .describe("Lending protocols to check"),
    positions: z
      .array(Position)
      .min(1)
      .max(50)
      .describe("Specific positions to track"),
  }),
  output: z.object({
    results: z.array(z.any()),
    alerts: z.array(z.any()),
  }),
  price: "1000",
  async handler({ input }) {
    const allResults: PositionSnapshot[] = [];
    const allAlerts: LiquidationAlert[] = [];

    for (const position of input.positions) {
      if (!input.protocol_ids.includes(position.protocol as never)) continue;

      const { snapshot, alert } = await evaluatePosition(position);
      lastSnapshots.set(position.id, snapshot);
      allResults.push(snapshot);
      if (alert) allAlerts.push(alert);
    }

    return {
      output: {
        results: allResults,
        alerts: allAlerts,
      },
      usage: {
        total_tokens: String(input.positions.length),
      },
    };
  },
});

export default app;
