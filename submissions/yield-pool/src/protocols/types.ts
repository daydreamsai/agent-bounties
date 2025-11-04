import type { PoolConfig } from "../config";
import type { PoolMetrics } from "../types";

export interface FetchContext {
  blockTag?: bigint | number;
  timestamp?: number;
  signal?: AbortSignal;
}

export interface ProtocolAdapter {
  id: string;
  supports: {
    protocolIds: string[];
    chains: number[];
  };
  fetchLatestMetrics(
    pool: PoolConfig,
    context: FetchContext
  ): Promise<PoolMetrics | null>;
}
