/**
 * Stable, JSON-serializable domain types shared by the watcher modules.
 *
 * Pool IDs are EIP-55 checksummed contract addresses. Callers should use
 * asPoolId() before constructing a PoolSnapshot.
 */
export type PoolId = string & { readonly __poolId: unique symbol };

export type ProtocolId = "aave-v3" | "uniswap-v3";
export type ChainId = "ethereum";
export type AlertMetric = "apy" | "tvl";
export type AlertSeverity = "low" | "medium" | "high";

export interface PoolMetrics {
  apy: number;
  tvl_usd: number;
  volume_24h_usd?: number;
  fees_24h_usd?: number;
  utilization?: number;
}

export interface PoolSnapshot {
  pool_id: PoolId;
  protocol_id: ProtocolId;
  chain: ChainId;
  captured_at: string;
  metrics: PoolMetrics;
}

export interface PoolDelta {
  pool_id: PoolId;
  previous_captured_at: string;
  captured_at: string;
  apy_change_bps: number;
  tvl_change_pct: number;
}

export interface Alert {
  id: string;
  pool_id: PoolId;
  protocol_id: ProtocolId;
  metric: AlertMetric;
  severity: AlertSeverity;
  previous_value: number;
  current_value: number;
  change_bps?: number;
  change_pct?: number;
  triggered_at: string;
  expires_at: string;
}

export interface AlertCooldown {
  pool_id: PoolId;
  metric: AlertMetric;
  last_triggered_at: string;
  expires_at: string;
}

export interface ThresholdRules {
  apy_change_bps: number;
  tvl_change_pct: number;
  min_tvl_usd: number;
}

export const DEFAULT_THRESHOLD_RULES: Readonly<ThresholdRules> = {
  apy_change_bps: 500,
  tvl_change_pct: 10,
  min_tvl_usd: 100_000,
};
