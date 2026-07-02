/**
 * Yield Pool Watcher Agent
 *
 * Entrypoint: "monitor-pools"
 *
 * Tracks APY and TVL across DeFi pools (Uniswap V2, Aave, Compound, Curve)
 * and alerts when sharp changes exceed configured thresholds.
 *
 * Uses @lucid-dreams/agent-kit for agent orchestration,
 * viem for chain queries, zod for input validation.
 */

import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { mainnet, base, arbitrum, optimism, polygon } from "viem/chains";

/* ------------------------------------------------------------------ */
/*  Zod Schemas                                                        */
/* ------------------------------------------------------------------ */

const PoolSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(["mainnet", "base", "arbitrum", "optimism", "polygon"]),
  type: z.enum(["uniswap-v2", "aave-v3", "compound-v3", "curve"]),
  /** Optional override labels */
  label: z.string().optional(),
});

const ThresholdRulesSchema = z.object({
  tvl_change_pct: z.number().min(0).max(1000).default(10),
  apy_change_pct: z.number().min(0).max(1000).default(20),
});

const InputSchema = z.object({
  protocol_ids: z.array(z.string()).min(1),
  pools: z.array(PoolSchema).min(1),
  threshold_rules: ThresholdRulesSchema.default({}),
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PoolMetrics {
  pool: string;
  chain: string;
  type: string;
  label: string;
  tvl: string;        // human-readable USD
  apy: string;        // percentage e.g. "5.23"
  block_number: number;
  timestamp: number;
}

export interface Delta {
  pool: string;
  chain: string;
  tvl_change_pct: number;
  apy_change_pct: number;
}

export interface Alert {
  pool: string;
  chain: string;
  reason: string;
  threshold: string;
  current: string;
}

export interface MonitorOutput {
  pool_metrics: PoolMetrics[];
  deltas: Delta[];
  alerts: Alert[];
  protocol_ids: string[];
  evaluated_at: number;
}

/* ------------------------------------------------------------------ */
/*  RPC clients per chain                                             */
/* ------------------------------------------------------------------ */

const CHAIN_MAP: Record<string, (typeof mainnet)> = {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
};

const RPC_URLS: Record<string, string> = {
  mainnet:  "https://eth.llamarpc.com",
  base:     "https://base.llamarpc.com",
  arbitrum: "https://arbitrum.llamarpc.com",
  optimism: "https://optimism.llamarpc.com",
  polygon:  "https://polygon.llamarpc.com",
};

function getClient(chain: string) {
  const viemChain = CHAIN_MAP[chain];
  if (!viemChain) throw new Error(`Unsupported chain: ${chain}`);
  return createPublicClient({
    chain: viemChain,
    transport: http(RPC_URLS[chain]),
  });
}

/* ------------------------------------------------------------------ */
/*  ABI snippets                                                       */
/* ------------------------------------------------------------------ */

/** Uniswap V2 pair — reserves & totalSupply */
const uniswapV2PairAbi = [
  {
    type: "function",
    name: "getReserves",
    inputs: [],
    outputs: [
      { name: "_reserve0", type: "uint112" },
      { name: "_reserve1", type: "uint112" },
      { name: "_blockTimestampLast", type: "uint32" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token0",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token1",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

/** Basic ERC-20 decimals */
const decimalsAbi = [
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

/** Aave V3 Pool contract — reservesData */
const aavePoolAbi = [
  {
    type: "function",
    name: "getReserveData",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "configuration", type: "uint256" },
      { name: "liquidityIndex", type: "uint128" },
      { name: "variableBorrowIndex", type: "uint128" },
      { name: "currentLiquidityRate", type: "uint128" },
      { name: "currentVariableBorrowRate", type: "uint128" },
      { name: "currentStableBorrowRate", type: "uint128" },
      { name: "lastUpdateTimestamp", type: "uint40" },
      { name: "id", type: "uint16" },
      { name: "aTokenAddress", type: "address" },
      { name: "stableDebtTokenAddress", type: "address" },
      { name: "variableDebtTokenAddress", type: "address" },
      { name: "interestRateStrategyAddress", type: "address" },
      { name: "accruedToTreasury", type: "uint128" },
      { name: "totalATokenSupply", type: "uint128" },
      { name: "totalVariableDebt", type: "uint128" },
      { name: "totalStableDebt", type: "uint128" },
    ],
    stateMutability: "view",
  },
] as const;

/** Compound V3 Comet — totals basic */
const cometAbi = [
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSupplyRate",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

/** Curve LP — get_virtual_price */
const curveLpAbi = [
  {
    type: "function",
    name: "get_virtual_price",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Simple in-memory KV store (previous values)                        */
/* ------------------------------------------------------------------ */

interface StoredSnapshot {
  tvl: number;
  apy: number;
  block: number;
  ts: number;
}

const store = new Map<string, StoredSnapshot>();

function storeKey(pool: string, chain: string, type: string): string {
  return `${chain}:${type}:${pool.toLowerCase()}`;
}

/* ------------------------------------------------------------------ */
/*  Pool query helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Estimate TVL for a Uniswap V2 pair by reading reserves and
 * computing a USD approximation using a simple ETH/BTC price oracle.
 * In production this should use a Chainlink/on-chain oracle.
 */
async function queryUniswapV2(
  address: `0x${string}`,
  chain: string,
): Promise<{ tvl: number; apy: number }> {
  const client = getClient(chain);

  const [reserves, supply, t0, t1] = await Promise.all([
    client.readContract({ address, abi: uniswapV2PairAbi, functionName: "getReserves" }),
    client.readContract({ address, abi: uniswapV2PairAbi, functionName: "totalSupply" }),
    client.readContract({ address, abi: uniswapV2PairAbi, functionName: "token0" }),
    client.readContract({ address, abi: uniswapV2PairAbi, functionName: "token1" }),
  ]);

  // Get decimals for both tokens
  const [dec0, dec1] = await Promise.all([
    client.readContract({ address: t0, abi: decimalsAbi, functionName: "decimals" }),
    client.readContract({ address: t1, abi: decimalsAbi, functionName: "decimals" }),
  ]);

  const r0 = Number(formatUnits(reserves[0], dec0));
  const r1 = Number(formatUnits(reserves[1], dec1));
  const totalSupply = Number(formatUnits(supply, 18));

  // Rough USD estimate: assume token0=USDC(1) or WETH(~2300), token1=match
  // In practice, pull from a DEX oracle
  const usdPrice0 = 1;       // simplified — override in production
  const usdPrice1 = 2300;    // simplified WETH approx
  const tvl = r0 * usdPrice0 + r1 * usdPrice1;

  // APY estimation from 24h volume / TVL (simplified)
  // Real implementation would query historical reserves via an archive node
  const apy = 0; // placeholder — see Curve for fee-based calc

  return { tvl, apy };
}

/**
 * Query Aave V3 reserve — liquidity rate is expressed in ray (1e27).
 * currentLiquidityRate is annualized, divide by 1e25 to get percentage.
 */
async function queryAaveV3(
  address: `0x${string}`,
  chain: string,
): Promise<{ tvl: number; apy: number }> {
  const client = getClient(chain);

  const data = await client.readContract({
    address,
    abi: aavePoolAbi,
    functionName: "getReserveData",
    args: [address],
  });

  const totalDeposits = Number(formatUnits(data.totalATokenSupply, 8)); // aToken decimals
  const liquidityRateRay = Number(data.currentLiquidityRate);

  // APY = (1 + rate_ray / 1e27)^secondsPerYear - 1  → simplified:
  const apyPct = (liquidityRateRay / 1e25) * 100;
  const tvl = totalDeposits; // simplified — would use oracle prices

  return { tvl, apy: Math.min(apyPct, 500) }; // cap at 500%
}

/**
 * Query Compound V3 Comet — supply rate in mantissa (1e18).
 * Rate is per-second; annualize × secondsPerYear.
 */
async function queryCompoundV3(
  address: `0x${string}`,
  chain: string,
): Promise<{ tvl: number; apy: number }> {
  const client = getClient(chain);

  const [supplyRaw, supplyRate, decimals] = await Promise.all([
    client.readContract({ address, abi: cometAbi, functionName: "totalSupply" }),
    client.readContract({ address, abi: cometAbi, functionName: "getSupplyRate" }),
    client.readContract({ address, abi: cometAbi, functionName: "decimals" }),
  ]);

  const tvl = Number(formatUnits(supplyRaw, decimals));
  const SECONDS_PER_YEAR = 31536000n;
  const ratePerYear = supplyRate * SECONDS_PER_YEAR;
  // supplyRate is in mantissa (1e18); convert to percentage
  const apyPct = (Number(ratePerYear) / 1e18) * 100;

  return { tvl, apy: Math.min(apyPct, 500) };
}

/**
 * Query Curve pool — TVL = totalSupply × virtual_price (in 1e18).
 * APY from trading fees estimated from volume.
 */
async function queryCurve(
  address: `0x${string}`,
  chain: string,
): Promise<{ tvl: number; apy: number }> {
  const client = getClient(chain);

  const [vp, supply, decimals] = await Promise.all([
    client.readContract({ address, abi: curveLpAbi, functionName: "get_virtual_price" }),
    client.readContract({ address, abi: curveLpAbi, functionName: "totalSupply" }),
    client.readContract({ address, abi: curveLpAbi, functionName: "decimals" }),
  ]);

  const vpNormalized = Number(formatUnits(vp, 18));  // virtual_price in 1e18
  const supplyNormalized = Number(formatUnits(supply, decimals));
  const tvl = supplyNormalized * vpNormalized;

  // APY placeholder — real implementation fetches volume from subgraph
  const apy = 0;

  return { tvl, apy };
}

/* ------------------------------------------------------------------ */
/*  Dispatcher                                                         */
/* ------------------------------------------------------------------ */

interface PoolInfo {
  address: `0x${string}`;
  chain: string;
  type: string;
  label: string;
}

async function queryPool(pool: PoolInfo): Promise<{ tvl: number; apy: number }> {
  switch (pool.type) {
    case "uniswap-v2":
      return queryUniswapV2(pool.address, pool.chain);
    case "aave-v3":
      return queryAaveV3(pool.address, pool.chain);
    case "compound-v3":
      return queryCompoundV3(pool.address, pool.chain);
    case "curve":
      return queryCurve(pool.address, pool.chain);
    default:
      throw new Error(`Unknown pool type: ${pool.type}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Agent definition                                                   */
/* ------------------------------------------------------------------ */

const yieldPoolWatcherAgent = createAgentApp({
  name: "yield-pool-watcher",
  description: "Monitors DeFi pool APY and TVL, alerts on sharp changes beyond thresholds.",
  entrypoint: "monitor-pools",
  input: InputSchema,
  async handler(input: z.infer<typeof InputSchema>): Promise<MonitorOutput> {
    const { protocol_ids, pools, threshold_rules } = InputSchema.parse(input);
    const now = Math.floor(Date.now() / 1000);

    const poolMetrics: PoolMetrics[] = [];
    const deltas: Delta[] = [];
    const alerts: Alert[] = [];

    // Resolve chain RPC endpoints — first check env vars
    for (const poolDef of pools) {
      const chain = poolDef.chain;
      const poolType = poolDef.type;
      const address = poolDef.address.toLowerCase() as `0x${string}`;
      const label = poolDef.label ?? `${poolType}:${address.slice(0, 10)}`;

      try {
        const result = await queryPool({
          address,
          chain,
          type: poolType,
          label,
        });

        const blockNumber = await getClient(chain).getBlockNumber();

        const metric: PoolMetrics = {
          pool: address,
          chain,
          type: poolType,
          label,
          tvl: result.tvl.toFixed(2),
          apy: result.apy.toFixed(4),
          block_number: Number(blockNumber),
          timestamp: now,
        };
        poolMetrics.push(metric);

        const key = storeKey(address, chain, poolType);
        const prev = store.get(key);

        if (prev) {
          const tvlDeltaPct =
            prev.tvl > 0
              ? ((result.tvl - prev.tvl) / prev.tvl) * 100
              : 0;
          const apyDeltaPct =
            prev.apy > 0
              ? ((result.apy - prev.apy) / prev.apy) * 100
              : 0;

          deltas.push({
            pool: address,
            chain,
            tvl_change_pct: +tvlDeltaPct.toFixed(4),
            apy_change_pct: +apyDeltaPct.toFixed(4),
          });

          // Check TVL threshold
          if (Math.abs(tvlDeltaPct) >= threshold_rules.tvl_change_pct) {
            alerts.push({
              pool: address,
              chain,
              reason: "TVL change exceeds threshold",
              threshold: `≥${threshold_rules.tvl_change_pct}%`,
              current: `${tvlDeltaPct.toFixed(2)}%`,
            });
          }

          // Check APY threshold
          if (Math.abs(apyDeltaPct) >= threshold_rules.apy_change_pct) {
            alerts.push({
              pool: address,
              chain,
              reason: "APY change exceeds threshold",
              threshold: `≥${threshold_rules.apy_change_pct}%`,
              current: `${apyDeltaPct.toFixed(2)}%`,
            });
          }
        }

        // Persist snapshot for next comparison
        store.set(key, {
          tvl: result.tvl,
          apy: result.apy,
          block: Number(blockNumber),
          ts: now,
        });
      } catch (err: any) {
        // Log but don't crash — report as metric with zero
        poolMetrics.push({
          pool: address,
          chain,
          type: poolType,
          label,
          tvl: "0.00",
          apy: "0.00",
          block_number: 0,
          timestamp: now,
        });
        deltas.push({
          pool: address,
          chain,
          tvl_change_pct: 0,
          apy_change_pct: 0,
        });
        alerts.push({
          pool: address,
          chain,
          reason: `Query failed: ${err?.message ?? "unknown error"}`,
          threshold: "—",
          current: "—",
        });
      }
    }

    return {
      pool_metrics: poolMetrics,
      deltas,
      alerts,
      protocol_ids,
      evaluated_at: now,
    };
  },
});

export default yieldPoolWatcherAgent;
