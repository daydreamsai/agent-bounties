import type { BorrowPosition, HealthFactorResult, SimulationResult, AlertConfig } from "./types.js";

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  warningThreshold: 1.5,
  dangerThreshold: 1.2,
  criticalThreshold: 1.05,
  checkIntervalMs: 60_000,
};

export function computeHealthFactor(pos: BorrowPosition): HealthFactorResult {
  const collateralValueUsd = pos.collateralAmount * pos.collateralPriceUsd;
  const borrowValueUsd = pos.borrowAmount * pos.borrowPriceUsd;
  
  if (borrowValueUsd === 0) {
    return {
      healthFactor: Infinity,
      liquidationPriceCollateral: 0,
      bufferPercent: Infinity,
      riskLevel: "safe",
      position: pos,
    };
  }

  const healthFactor = (collateralValueUsd * pos.liquidationThreshold) / borrowValueUsd;
  
  // Price at which HF = 1.0 (liquidation)
  const liquidationPriceCollateral = borrowValueUsd / (pos.collateralAmount * pos.liquidationThreshold);
  
  const bufferPercent = ((pos.collateralPriceUsd - liquidationPriceCollateral) / pos.collateralPriceUsd) * 100;
  
  const riskLevel = classifyRisk(healthFactor, DEFAULT_ALERT_CONFIG);

  return { healthFactor, liquidationPriceCollateral, bufferPercent, riskLevel, position: pos };
}

export function classifyRisk(hf: number, config: AlertConfig): "safe" | "warning" | "danger" | "critical" {
  if (hf < config.criticalThreshold) return "critical";
  if (hf < config.dangerThreshold) return "danger";
  if (hf < config.warningThreshold) return "warning";
  return "safe";
}

export function simulatePriceDrop(pos: BorrowPosition, crashPercent: number): SimulationResult {
  const newCollateralPrice = pos.collateralPriceUsd * (1 - crashPercent / 100);
  const simulatedPos = { ...pos, collateralPriceUsd: newCollateralPrice };
  const result = computeHealthFactor(simulatedPos);
  
  return {
    crashPercent,
    newCollateralPrice,
    newHealthFactor: result.healthFactor,
    riskLevel: result.riskLevel,
    wouldLiquidate: result.healthFactor < 1.0,
  };
}

export function computeMultiplePositions(positions: BorrowPosition[]): HealthFactorResult[] {
  return positions.map(computeHealthFactor);
}
