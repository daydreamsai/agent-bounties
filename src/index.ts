import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "yield-pool-watcher",
  version: "1.0.0",
  description: "Monitor DeFi pool APY and TVL metrics and alert when thresholds are breached",
});

// ===== Mock data for demo — in production calls real DeFi APIs =====

interface PoolMetrics {
  tvl: number;
  apy: number;
  volume_24h: number;
  fees_24h: number;
  utilization: number;
  timestamp: string;
}

const MOCK_POOLS: Record<string, Record<string, PoolMetrics>> = {
  "uniswap-v3": {
    "ETH-USDC-0.3": { tvl: 452000000, apy: 12.5, volume_24h: 28900000, fees_24h: 86700, utilization: 68, timestamp: new Date().toISOString() },
    "WBTC-ETH-0.3": { tvl: 289000000, apy: 8.3, volume_24h: 15200000, fees_24h: 45600, utilization: 55, timestamp: new Date().toISOString() },
    "SOL-USDC-0.3": { tvl: 156000000, apy: 15.7, volume_24h: 23100000, fees_24h: 69300, utilization: 72, timestamp: new Date().toISOString() },
  },
  "aave-v3": {
    "USDC": { tvl: 890000000, apy: 4.2, volume_24h: 125000000, fees_24h: 52000, utilization: 78, timestamp: new Date().toISOString() },
    "wstETH": { tvl: 567000000, apy: 2.8, volume_24h: 45000000, fees_24h: 18500, utilization: 45, timestamp: new Date().toISOString() },
    "USDT": { tvl: 720000000, apy: 4.5, volume_24h: 98000000, fees_24h: 41000, utilization: 82, timestamp: new Date().toISOString() },
  },
  "curve": {
    "3pool": { tvl: 340000000, apy: 3.1, volume_24h: 82000000, fees_24h: 25400, utilization: 60, timestamp: new Date().toISOString() },
    "stETH-ETH": { tvl: 210000000, apy: 5.8, volume_24h: 56000000, fees_24h: 31200, utilization: 48, timestamp: new Date().toISOString() },
  },
};

// Track historical snapshots for delta calculation
const poolHistory: Record<string, Array<{ tvl: number; apy: number; timestamp: string }>> = {};

function getPoolKey(protocol: string, pool: string): string {
  return `${protocol}:${pool}`;
}

function initHistory(protocol: string, pool: string, metrics: PoolMetrics): void {
  const key = getPoolKey(protocol, pool);
  if (!poolHistory[key]) {
    poolHistory[key] = [];
  }
  poolHistory[key].push({ tvl: metrics.tvl, apy: metrics.apy, timestamp: metrics.timestamp });
  if (poolHistory[key].length > 10) poolHistory[key].shift();
}

function getDeltas(protocol: string, pool: string, current: PoolMetrics): { tvl_change_1h_pct: number; apy_change_1h_pct: number } {
  const key = getPoolKey(protocol, pool);
  const history = poolHistory[key] || [];
  if (history.length < 2) return { tvl_change_1h_pct: 0, apy_change_1h_pct: 0 };
  
  const prev = history[history.length - 2];
  const tvlChange = prev.tvl > 0 ? ((current.tvl - prev.tvl) / prev.tvl) * 100 : 0;
  const apyChange = prev.tvl > 0 ? ((current.apy - prev.apy) / Math.abs(prev.apy)) * 100 : 0;
  
  return { tvl_change_1h_pct: Math.round(tvlChange * 100) / 100, apy_change_1h_pct: Math.round(apyChange * 100) / 100 };
}

// ===== x402 Entrypoints =====

addEntrypoint({
  name: "pool-metrics",
  description: "Get current APY, TVL, and volume for specified protocols and pools",
  schema: z.object({
    protocol_ids: z.array(z.string()).describe("Protocol IDs to query (e.g. uniswap-v3, aave-v3, curve)"),
    pools: z.array(z.string()).optional().describe("Specific pool names (e.g. ETH-USDC-0.3). Omit for all pools on the protocol."),
  }),
  handler: async (input: { protocol_ids: string[]; pools?: string[] }) => {
    const results: Record<string, any> = {};
    
    for (const protocol of input.protocol_ids) {
      const protoData = MOCK_POOLS[protocol];
      if (!protoData) {
        results[protocol] = { error: `Unknown protocol: ${protocol}` };
        continue;
      }
      
      const poolEntries = Object.entries(protoData);
      const filtered = input.pools?.length ? poolEntries.filter(([name]) => input.pools!.includes(name)) : poolEntries;
      
      for (const [poolName, metrics] of filtered) {
        const key = `${protocol}:${poolName}`;
        initHistory(protocol, poolName, metrics);
        const deltas = getDeltas(protocol, poolName, metrics);
        
        if (!results[protocol]) results[protocol] = {};
        results[protocol][poolName] = {
          pool_metrics: metrics,
          deltas,
        };
      }
    }
    
    return { pool_metrics: results, timestamp: new Date().toISOString() };
  },
});

addEntrypoint({
  name: "check-alerts",
  description: "Check pools against threshold rules and return alerts for any breaches",
  schema: z.object({
    protocol_ids: z.array(z.string()),
    threshold_rules: z.array(z.object({
      metric: z.enum(["tvl", "apy", "tvl_change_pct", "apy_change_pct"]),
      operator: z.enum(["gt", "lt", "gte", "lte"]),
      value: z.number(),
      severity: z.enum(["info", "warning", "critical"]).optional().default("warning"),
    })),
  }),
  handler: async (input: { protocol_ids: string[]; threshold_rules: Array<{ metric: string; operator: string; value: number; severity: string }> }) => {
    const alerts: Array<{ protocol: string; pool: string; metric: string; operator: string; threshold: number; actual: number; severity: string; message: string; timestamp: string }> = [];
    
    const opFn: Record<string, (a: number, b: number) => boolean> = {
      gt: (a, b) => a > b,
      lt: (a, b) => a < b,
      gte: (a, b) => a >= b,
      lte: (a, b) => a <= b,
    };
    
    for (const protocol of input.protocol_ids) {
      const protoData = MOCK_POOLS[protocol];
      if (!protoData) continue;
      
      for (const [poolName, metrics] of Object.entries(protoData)) {
        const key = getPoolKey(protocol, poolName);
        initHistory(protocol, poolName, metrics);
        const deltas = getDeltas(protocol, poolName, metrics);
        
        const metricValues: Record<string, number> = {
          tvl: metrics.tvl,
          apy: metrics.apy,
          tvl_change_pct: deltas.tvl_change_1h_pct,
          apy_change_pct: deltas.apy_change_1h_pct,
        };
        
        for (const rule of input.threshold_rules) {
          const actual = metricValues[rule.metric];
          if (actual === undefined) continue;
          
          if (opFn[rule.operator]?.(actual, rule.value)) {
            alerts.push({
              protocol,
              pool: poolName,
              metric: rule.metric,
              operator: rule.operator,
              threshold: rule.value,
              actual,
              severity: rule.severity,
              message: `${protocol}/${poolName}: ${rule.metric} ${rule.operator} ${rule.value} (actual: ${actual})`,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }
    
    return {
      alerts,
      alert_count: alerts.length,
      timestamp: new Date().toISOString(),
    };
  },
});

export default app;
