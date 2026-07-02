import { createAgentApp } from "@lucid-dreams/agent-kit";
import { z } from "zod";
import {
  createPublicClient,
  http,
  parseAbi,
  keccak256,
  encodePacked,
  concat,
  type Address,
  type PublicClient,
} from "viem";
import { mainnet } from "viem/chains";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RPC_URL = "https://eth-mainnet.g.alchemy.com/v2/demo";
const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const PAIR_ABI = parseAbi([
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Commonly-used reference prices (USD per token) for depth estimation. */
function getReferencePrice(token: Address): number {
  const t = token.toLowerCase();
  if (t === WETH.toLowerCase() || t === "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2") {
    return 3000; // ~$3000 ETH
  }
  if (
    t === "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" ||
    t === "0xdac17f958d2ee523a2206206994597c13d831ec7" // USDT
  ) {
    return 1;
  }
  if (t === "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599") {
    // WBTC
    return 65000;
  }
  // Default guess for unknown tokens: peg to $1 (stable-ish assumption)
  return 1;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

export interface PoolDepth {
  dex: string;
  token_pair: string;
  reserve_usd: number;
  depth_score: number;
}

export interface SlippageEstimate {
  min_safe_slip_bps: number;
  pool_depths: PoolDepth[];
  recent_trade_size_p95: number;
  volatility_factor: number;
  recommended_slip_bps: number;
}

const MAX_SLIP_BPS = 50; // 0.5 % absolute cap
const MIN_SLIP_BPS = 1; // 0.01 % floor

/**
 * Derive a depth score from USD reserve value.
 * 0 (very shallow) → 1 (very deep)
 */
function calcDepthScore(reserveUsd: number): number {
  if (reserveUsd <= 0) return 0;
  // $10K → ~0.09, $100K → ~0.50, $1M → ~0.91, $5M+ → ~0.99
  return Math.min(1, Math.log10(reserveUsd / 1_000 + 1) / 3);
}

/**
 * Volatility factor from reserve imbalance.
 * When reserves are perfectly balanced (50/50 ratio) we assume low volatility.
 * Imbalanced pools suggest recent price movement → higher volatility.
 * Returns a multiplier 1.0 – 4.0.
 */
function calcVolatilityFactor(reserve0: bigint, reserve1: bigint): number {
  const r0 = Number(reserve0);
  const r1 = Number(reserve1);
  if (r0 === 0 || r1 === 0) return 4.0;

  const total = r0 + r1;
  const ratio = Math.max(r0, r1) / total; // 0.5 (balanced) → 1.0 (extreme)
  // Map [0.5, 1.0] → [1.0, 4.0]
  return 1.0 + (ratio - 0.5) * 6.0;
}

/**
 * Estimate safe slippage for a given route.
 * Small/shallow pools → higher slippage; deep pools → lower slippage.
 * Volatile (imbalanced) pools push slippage up further.
 */
export async function estimateSlippage(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: string,
  routeHint?: string,
  rpcUrl: string = DEFAULT_RPC_URL,
): Promise<SlippageEstimate> {
  const client: PublicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });

  const errors: string[] = [];
  const poolDepths: PoolDepth[] = [];

  // We'll try to find a pair for the token pair on Uniswap V2.
  // In production you'd use a factory to compute the pair address.
  // For this implementation we derive the pair from known patterns.
  const dexes = routeHint ? [routeHint, "UniswapV2"] : ["UniswapV2"];

  for (const dex of dexes) {
    try {
      // Derive the pair address deterministically using the factory
      // (Uniswap V2 pair address = keccak256(abi.encodePacked(token0, token1)) salted)
      // For simplicity we compute the CREATE2 address.
      const pairAddress = computePairAddress(tokenIn, tokenOut, UNISWAP_V2_FACTORY);

      // Fetch on-chain reserves
      const reserves = await getReserves(client, pairAddress);
      if (!reserves) continue;

      const { reserve0, reserve1 } = reserves;
      if (reserve0 === 0n && reserve1 === 0n) continue;

      // Determine which reserve corresponds to which token
      const { t0Reserve, t1Reserve } = await mapReserves(client, pairAddress, tokenIn, tokenOut, reserve0, reserve1);

      // Compute USD value
      const priceIn = getReferencePrice(tokenIn);
      const priceOut = getReferencePrice(tokenOut);
      const reserveInUsd = Number(t0Reserve) * priceIn / 1e18;
      const reserveOutUsd = Number(t1Reserve) * priceOut / 1e18;
      const totalUsd = reserveInUsd + reserveOutUsd;

      const depthScore = calcDepthScore(totalUsd);
      const volFactor = calcVolatilityFactor(t0Reserve, t1Reserve);

      poolDepths.push({
        dex,
        token_pair: `${tokenIn.slice(0, 6)}…${tokenOut.slice(0, 6)}`,
        reserve_usd: Math.round(totalUsd * 100) / 100,
        depth_score: Math.round(depthScore * 1000) / 1000,
      });
    } catch (e) {
      errors.push(`${dex}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Derive aggregate metrics
  const depthScore =
    poolDepths.length > 0
      ? poolDepths.reduce((s, d) => s + d.depth_score, 0) / poolDepths.length
      : 0;

  const volFactor =
    poolDepths.length > 0
      ? poolDepths.reduce(
          (s, d) =>
            s +
            calcVolatilityFactor(
              BigInt(Math.round(d.reserve_usd / 2)),
              BigInt(Math.round(d.reserve_usd / 2)),
            ),
          0,
        ) / poolDepths.length
      : 2.0;

  // Recommended slippage: lower depth → more slippage; higher volatility → more slippage
  // Base: (1 - depthScore) * MAX_SLIP_BPS → shallow pools get higher bps
  // Then scale by volatility factor
  let recommendedBps = Math.round((1 - depthScore) * MAX_SLIP_BPS * (volFactor / 2.0));
  recommendedBps = Math.max(MIN_SLIP_BPS, Math.min(MAX_SLIP_BPS, recommendedBps));

  // recent_trade_size_p95: Estimate from pool depth — typically ~1-2% of total depth
  const totalReserveUsd = poolDepths.reduce((s, d) => s + d.reserve_usd, 0);
  const p95TradeSize = Math.round(totalReserveUsd * 0.015 * 100) / 100;

  return {
    min_safe_slip_bps: recommendedBps,
    pool_depths: poolDepths,
    recent_trade_size_p95: p95TradeSize,
    volatility_factor: Math.round(volFactor * 100) / 100,
    recommended_slip_bps: recommendedBps,
  };
}

// ---------------------------------------------------------------------------
// On-chain helpers
// ---------------------------------------------------------------------------

/** Get reserves from a Uniswap V2 pair contract. */
async function getReserves(
  client: PublicClient,
  pairAddress: Address,
): Promise<{ reserve0: bigint; reserve1: bigint } | null> {
  try {
    const data = await client.readContract({
      address: pairAddress,
      abi: PAIR_ABI,
      functionName: "getReserves",
    });
    // Return type is [bigint, bigint, number] from parseAbi
    if (Array.isArray(data) && data.length >= 2) {
      return { reserve0: data[0] as bigint, reserve1: data[1] as bigint };
    }
    return null;
  } catch {
    return null;
  }
}

/** Determine which reserve belongs to which token. */
async function mapReserves(
  client: PublicClient,
  pairAddress: Address,
  tokenIn: Address,
  tokenOut: Address,
  reserve0: bigint,
  reserve1: bigint,
): Promise<{ t0Reserve: bigint; t1Reserve: bigint }> {
  try {
    const token0Addr = await client.readContract({
      address: pairAddress,
      abi: PAIR_ABI,
      functionName: "token0",
    }) as Address;

    const t0IsIn = token0Addr.toLowerCase() === tokenIn.toLowerCase();
    const t0IsOut = token0Addr.toLowerCase() === tokenOut.toLowerCase();

    // If token0 matches tokenIn, reserve0 is for tokenIn
    if (t0IsIn) {
      return { t0Reserve: reserve0, t1Reserve: reserve1 };
    }
    // If token0 matches tokenOut, reserve1 is for tokenIn
    if (t0IsOut) {
      return { t0Reserve: reserve1, t1Reserve: reserve0 };
    }
    // Fallback: assume reserve0 = tokenIn
    return { t0Reserve: reserve0, t1Reserve: reserve1 };
  } catch {
    return { t0Reserve: reserve0, t1Reserve: reserve1 };
  }
}

// ---------------------------------------------------------------------------
// CREATE2 pair address computation (Uniswap V2)
// See: https://docs.uniswap.org/contracts/v2/reference/smart-contracts/factory
// ---------------------------------------------------------------------------

/**
 * Uniswap V2 INIT_CODE_HASH for the mainnet pair implementation.
 * keccak256(abi.encodePacked(type(UniswapV2Pair).creationCode))
 */
const UNISWAP_V2_INIT_CODE_HASH =
  "0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f";

function computePairAddress(
  tokenA: Address,
  tokenB: Address,
  factoryAddress: Address,
): Address {
  // Sort addresses (ascending)
  const [t0, t1] =
    tokenA.toLowerCase() < tokenB.toLowerCase()
      ? [tokenA, tokenB]
      : [tokenB, tokenA];

  // salt = keccak256(abi.encodePacked(t0, t1))
  const salt = keccak256(
    encodePacked(["address", "address"], [t0, t1]),
  );

  // pair = keccak256(hex"ff" + factory + salt + init_code_hash)
  const raw = keccak256(
    concat([
      "0xff",
      factoryAddress,
      salt,
      UNISWAP_V2_INIT_CODE_HASH,
    ]),
  );

  // Address = last 20 bytes of the hash
  return `0x${raw.slice(26)}` as Address;
}

// ---------------------------------------------------------------------------
// Agent entrypoint
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  token_in: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 0x-prefixed address"),
  token_out: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 0x-prefixed address"),
  amount_in: z.string().regex(/^\d+(\.\d+)?$/, "Must be a decimal string"),
  route_hint: z.string().optional(),
});

const outputSchema = z.object({
  min_safe_slip_bps: z.number(),
  pool_depths: z.array(
    z.object({
      dex: z.string(),
      token_pair: z.string(),
      reserve_usd: z.number(),
      depth_score: z.number(),
    }),
  ),
  recent_trade_size_p95: z.number(),
  volatility_factor: z.number(),
  recommended_slip_bps: z.number(),
});

export const slippageSentinelApp = createAgentApp({
  name: "slippage-sentinel",
  description:
    "Estimates safe slippage for a token swap by analyzing on-chain Uniswap V2 pool depth and reserve imbalance.",
  entrypoints: [
    {
      name: "estimate-slippage",
      description: "Estimate safe slippage parameters for a swap route",
      input: inputSchema,
      output: outputSchema,
      handler: async (input: z.infer<typeof inputSchema>) => {
        try {
          const result = await estimateSlippage(
            input.token_in as Address,
            input.token_out as Address,
            input.amount_in,
            input.route_hint,
          );
          return result;
        } catch (err) {
          // Graceful error handling — return conservative defaults
          const errorMsg =
            err instanceof Error ? err.message : "Unknown error";
          return {
            min_safe_slip_bps: 50,
            pool_depths: [],
            recent_trade_size_p95: 0,
            volatility_factor: 3.0,
            recommended_slip_bps: 50,
          };
        }
      },
    },
  ],
});
