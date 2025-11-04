export type NumericMetric = number | null | undefined;

export interface PoolMetrics {
  protocolId: string;
  poolId: string;
  chainId: number;
  address: `0x${string}`;
  blockNumber?: bigint | number;
  timestamp: number;
  apy?: number | null;
  tvl?: number | null;
  raw?: Record<string, unknown>;
}

export type MetricKind = "tvl" | "apy";

export interface DeltaSnapshot {
  protocolId: string;
  poolId: string;
  metric: MetricKind;
  previous: NumericMetric;
  current: NumericMetric;
  absoluteChange: NumericMetric;
  percentChange: NumericMetric;
  timestamp: number;
  blockNumber?: bigint | number;
}

export interface AlertEvent {
  id: string;
  protocolId: string;
  poolId: string;
  metric: MetricKind;
  ruleId: string;
  triggeredAt: number;
  blockNumber?: bigint | number;
  changeDirection: "increase" | "decrease";
  changeAmount: NumericMetric;
  percentChange: NumericMetric;
  message: string;
  metadata?: Record<string, unknown>;
}
