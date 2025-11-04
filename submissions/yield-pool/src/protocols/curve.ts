import type { PoolConfig } from "../config";
import type { PoolMetrics } from "../types";
import type { FetchContext, ProtocolAdapter } from "./types";

const UNSUPPORTED_MESSAGE =
  "fetchLatestMetrics not yet implemented for Curve pools. TODO: wire Curve registry calls.";

async function fetchCurveMetrics(
  pool: PoolConfig,
  context: FetchContext
): Promise<PoolMetrics | null> {
  console.warn(
    `[curve] ${UNSUPPORTED_MESSAGE}`,
    JSON.stringify({ poolId: pool.id, chainId: pool.chainId })
  );

  return {
    protocolId: pool.protocolId,
    poolId: pool.id,
    chainId: pool.chainId,
    address: pool.address as `0x${string}`,
    timestamp: context.timestamp ?? Date.now(),
    apy: null,
    tvl: null,
    raw: {
      note: "Placeholder payload. Replace with live Curve metrics.",
    },
  };
}

export const curveAdapter: ProtocolAdapter = {
  id: "curve",
  supports: {
    protocolIds: ["curve"],
    chains: [1, 10, 137, 42161, 8453],
  },
  async fetchLatestMetrics(pool: PoolConfig, context: FetchContext) {
    return fetchCurveMetrics(pool, context);
  },
};
