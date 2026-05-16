export type ProtocolId = "aave-v3" | "compound-v3";
export type ChainId = "ethereum" | "arbitrum" | "optimism" | "polygon" | "base";

export interface BorrowPosition {
  protocol: ProtocolId;
  chain: ChainId;
  collateralAsset: string;
  collateralAmount: number;
  collateralPriceUsd: number;
  borrowAsset: string;
  borrowAmount: number;
  borrowPriceUsd: number;
  liquidationThreshold: number; // e.g. 0.85
  ltv: number; // e.g. 0.80
}

export interface HealthFactorResult {
  healthFactor: number;
  liquidationPriceCollateral: number;
  bufferPercent: number;
  riskLevel: "safe" | "warning" | "danger" | "critical";
  position: BorrowPosition;
}

export interface SimulationResult {
  crashPercent: number;
  newCollateralPrice: number;
  newHealthFactor: number;
  riskLevel: "safe" | "warning" | "danger" | "critical";
  wouldLiquidate: boolean;
}

export interface AlertConfig {
  warningThreshold: number;  // HF below this triggers warning
  dangerThreshold: number;   // HF below this triggers danger
  criticalThreshold: number; // HF below this triggers critical
  checkIntervalMs: number;
}
