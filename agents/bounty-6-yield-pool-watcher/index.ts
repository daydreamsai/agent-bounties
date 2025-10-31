import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

const { app, addEntrypoint } = createAgentApp({
  name: "yield-pool-watcher",
  version: "0.1.0",
  description: "Track APY and TVL across pools and alert on changes",
});

interface PoolMetrics {
  pool_id: string;
  apy: number;
  tvl: string;
  timestamp: number;
}

interface Delta {
  pool_id: string;
  apy_change: number;
  tvl_change: string;
  tvl_change_percent: number;
}

interface Alert {
  pool_id: string;
  type: "apy_spike" | "apy_drop" | "tvl_drain" | "tvl_spike";
  message: string;
  severity: "high" | "medium" | "low";
}

// Real protocol addresses
const PROTOCOL_ADDRESSES: Record<string, { lendingPool?: string; comptroller?: string; registry?: string }> = {
  aave: {
    lendingPool: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9", // Aave V2 LendingPool
  },
  compound: {
    comptroller: "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B", // Compound Comptroller
  },
  yearn: {
    registry: "0x50c1a2eA0a861A967D9d0FFE2AE4012c2E053804", // Yearn Registry
  },
};

// Aave V2 Lending Pool ABI
const AAVE_LENDING_POOL_ABI = [
  "function getReserveData(address asset) view returns (uint128 currentLiquidityRate, uint128 currentStableBorrowRate, uint128 currentVariableBorrowRate, uint128 liquidityIndex, uint128 variableBorrowIndex, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id)",
  "function getReservesList() view returns (address[] memory)",
];

// Compound Comptroller ABI
const COMPOUND_COMPTROLLER_ABI = [
  "function markets(address) view returns (bool isListed, uint256 collateralFactorMantissa, bool isComptroller)",
  "function getAllMarkets() view returns (address[] memory)",
];

const C_TOKEN_ABI = [
  "function supplyRatePerBlock() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function exchangeRateStored() view returns (uint256)",
  "function underlying() view returns (address)",
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
];

// In-memory storage for pool history
const poolHistory: Map<string, PoolMetrics[]> = new Map();

async function fetchAavePoolMetrics(
  provider: ethers.Provider,
  poolAddress: string
): Promise<PoolMetrics | null> {
  try {
    const lendingPool = new ethers.Contract(poolAddress, AAVE_LENDING_POOL_ABI, provider);
    
    // Get all reserves
    const reserves = await lendingPool.getReservesList();
    if (reserves.length === 0) return null;
    
    // Use first reserve as example (in production, monitor all)
    const reserve = reserves[0];
    const reserveData = await lendingPool.getReserveData(reserve);
    
    const currentLiquidityRate = reserveData[0];
    // APY = (liquidityRate / 1e27) * 365 * 24 * 3600
    const liquidityRateDecimal = Number(currentLiquidityRate) / 1e27;
    const apy = liquidityRateDecimal * 365 * 24 * 3600 * 100;
    
    // Calculate TVL from aToken
    const aTokenAddress = reserveData[6];
    const aTokenContract = new ethers.Contract(aTokenAddress, ERC20_ABI, provider);
    const totalATokens = await aTokenContract.totalSupply();
    
    const underlyingContract = new ethers.Contract(reserve, ERC20_ABI, provider);
    const decimals = await underlyingContract.decimals();
    const tvl = ethers.formatUnits(totalATokens, decimals);
    
    return {
      pool_id: `aave:${poolAddress}:${reserve}`,
      apy,
      tvl,
      timestamp: Math.floor(Date.now() / 1000),
    };
  } catch (error) {
    console.error("Error fetching Aave metrics:", error);
    return null;
  }
}

async function fetchCompoundPoolMetrics(
  provider: ethers.Provider,
  comptrollerAddress: string
): Promise<PoolMetrics | null> {
  try {
    const comptroller = new ethers.Contract(comptrollerAddress, COMPOUND_COMPTROLLER_ABI, provider);
    const markets = await comptroller.getAllMarkets();
    
    if (markets.length === 0) return null;
    
    // Use first market as example
    const cTokenAddress = markets[0];
    const cToken = new ethers.Contract(cTokenAddress, C_TOKEN_ABI, provider);
    
    const supplyRatePerBlock = await cToken.supplyRatePerBlock();
    const blocksPerYear = 2102400; // Ethereum blocks per year
    const apy = (Number(supplyRatePerBlock) / 1e18) * blocksPerYear * 100;
    
    const totalSupply = await cToken.totalSupply();
    const exchangeRate = await cToken.exchangeRateStored();
    const underlyingAddress = await cToken.underlying();
    
    const underlyingContract = new ethers.Contract(underlyingAddress, ERC20_ABI, provider);
    const decimals = await underlyingContract.decimals();
    
    // TVL = totalSupply * exchangeRate / 10^18
    const tvlRaw = (totalSupply * exchangeRate) / BigInt(10 ** 18);
    const tvl = ethers.formatUnits(tvlRaw, decimals);
    
    return {
      pool_id: `compound:${comptrollerAddress}:${cTokenAddress}`,
      apy,
      tvl,
      timestamp: Math.floor(Date.now() / 1000),
    };
  } catch (error) {
    console.error("Error fetching Compound metrics:", error);
    return null;
  }
}

async function fetchPoolMetrics(
  provider: ethers.Provider,
  protocolId: string,
  poolAddress?: string
): Promise<PoolMetrics | null> {
  const protocol = PROTOCOL_ADDRESSES[protocolId.toLowerCase()];
  if (!protocol) return null;
  
  const rpcUrl = process.env.RPC_URL || "https://eth.llamarpc.com";
  const provider_instance = new ethers.JsonRpcProvider(rpcUrl);
  
  if (protocolId.toLowerCase() === "aave" && protocol.lendingPool) {
    return fetchAavePoolMetrics(provider_instance, protocol.lendingPool);
  } else if (protocolId.toLowerCase() === "compound" && protocol.comptroller) {
    return fetchCompoundPoolMetrics(provider_instance, protocol.comptroller);
  }
  
  return null;
}

function calculateDeltas(
  current: PoolMetrics,
  previous: PoolMetrics
): Delta {
  const apyChange = current.apy - previous.apy;
  const tvlChange = BigInt(current.tvl || "0") - BigInt(previous.tvl || "0");
  const tvlChangePercent =
    previous.tvl !== "0"
      ? (Number(tvlChange) / Number(previous.tvl)) * 100
      : 0;

  return {
    pool_id: current.pool_id,
    apy_change: apyChange,
    tvl_change: tvlChange.toString(),
    tvl_change_percent: tvlChangePercent,
  };
}

function checkAlerts(
  delta: Delta,
  thresholdRules: any
): Alert[] {
  const alerts: Alert[] = [];

  const apyThreshold = thresholdRules.apy_change_percent || 10;
  const tvlThreshold = thresholdRules.tvl_change_percent || 20;

  if (Math.abs(delta.apy_change) >= apyThreshold) {
    alerts.push({
      pool_id: delta.pool_id,
      type: delta.apy_change > 0 ? "apy_spike" : "apy_drop",
      message: `APY changed by ${delta.apy_change.toFixed(2)}%`,
      severity: Math.abs(delta.apy_change) >= apyThreshold * 2 ? "high" : "medium",
    });
  }

  if (Math.abs(delta.tvl_change_percent) >= tvlThreshold) {
    alerts.push({
      pool_id: delta.pool_id,
      type: delta.tvl_change_percent > 0 ? "tvl_spike" : "tvl_drain",
      message: `TVL changed by ${delta.tvl_change_percent.toFixed(2)}%`,
      severity: Math.abs(delta.tvl_change_percent) >= tvlThreshold * 2 ? "high" : "medium",
    });
  }

  return alerts;
}

addEntrypoint({
  key: "monitor_pools",
  description: "Monitor pool metrics and emit alerts on spikes or drains",
  input: z.object({
    protocol_ids: z.array(z.string()).describe("DeFi protocols to monitor"),
    pools: z
      .array(z.string())
      .optional()
      .describe("Specific pools to watch"),
    threshold_rules: z
      .object({
        apy_change_percent: z.number().optional(),
        tvl_change_percent: z.number().optional(),
      })
      .optional()
      .describe("Alert threshold configuration"),
  }),
  async handler({ input }) {
    try {
      const poolMetrics: PoolMetrics[] = [];
      const deltas: Delta[] = [];
      const alerts: Alert[] = [];

      const thresholdRules = input.threshold_rules || {
        apy_change_percent: 10,
        tvl_change_percent: 20,
      };

      const rpcUrl = process.env.RPC_URL || "https://eth.llamarpc.com";
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Monitor each protocol/pool
      for (const protocolId of input.protocol_ids) {
        const pools = input.pools || [];
        
        if (pools.length > 0) {
          for (const pool of pools) {
            const metrics = await fetchPoolMetrics(provider, protocolId, pool);
            if (!metrics) continue;

            poolMetrics.push(metrics);

            // Get previous metrics
            const history = poolHistory.get(metrics.pool_id) || [];
            if (history.length > 0) {
              const previous = history[history.length - 1];
              const delta = calculateDeltas(metrics, previous);
              deltas.push(delta);

              // Check for alerts
              const poolAlerts = checkAlerts(delta, thresholdRules);
              alerts.push(...poolAlerts);
            }

            // Update history
            history.push(metrics);
            if (history.length > 100) history.shift();
            poolHistory.set(metrics.pool_id, history);
          }
        } else {
          // Fetch default pools for protocol
          const metrics = await fetchPoolMetrics(provider, protocolId);
          if (metrics) {
            poolMetrics.push(metrics);

            const history = poolHistory.get(metrics.pool_id) || [];
            if (history.length > 0) {
              const previous = history[history.length - 1];
              const delta = calculateDeltas(metrics, previous);
              deltas.push(delta);

              const poolAlerts = checkAlerts(delta, thresholdRules);
              alerts.push(...poolAlerts);
            }

            history.push(metrics);
            if (history.length > 100) history.shift();
            poolHistory.set(metrics.pool_id, history);
          }
        }
      }

      return {
        output: {
          pool_metrics: poolMetrics,
          deltas,
          alerts,
        },
        usage: {
          total_tokens: JSON.stringify({ poolMetrics, deltas, alerts }).length,
        },
      };
    } catch (error: any) {
      return {
        output: {
          error: error.message || "Unknown error occurred",
          pool_metrics: [],
          deltas: [],
          alerts: [],
        },
        usage: {
          total_tokens: 100,
        },
      };
    }
  },
});

// Start HTTP server if run directly
import { serve } from '@hono/node-server';

// Always start server when run as main module
const port = Number(process.env.PORT) || 3000;
serve({
  fetch: app.fetch,
  port,
}, () => {
  console.log(`Agent server running on http://localhost:${port}`);
});

export default app;
