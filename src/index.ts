/**
 * Slippage Sentinel — 估算任何 swap 路由的安全滑点容差
 *
 * 核心逻辑：
 * 1. 查询池子深度（pool depth）
 * 2. 计算近期交易量 P95（波动率参考）
 * 3. 结合池子流动性给出建议滑点（bps）
 *
 * 输入规则来自 github.com/daydreamsai/agent-bounties/issues/3
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp({
  name: "slippage-sentinel",
  version: "0.1.0",
  description: "Estimate safe slippage tolerance for any swap route",
});

// ── 类型定义 ──────────────────────────────────────────

interface PoolDepth {
  dex: string;
  tokenInReserve: string;
  tokenOutReserve: string;
  liquidityUSD: number;
}

interface TradeRecord {
  amount: number;
  timestamp: number;
}

// ── 模拟链上数据源（生产环境替换为真实 RPC 调用） ──

/** 获取池子深度数据 */
async function fetchPoolDepths(
  tokenIn: string,
  tokenOut: string,
  routeHint?: string
): Promise<PoolDepth[]> {
  // TODO: 连接 DEX 子图或 RPC 获取真实流动性数据
  // 当前返回模拟数据用于演示
  const pool: PoolDepth = {
    dex: routeHint ?? "Uniswap V3",
    tokenInReserve: "1_000_000",
    tokenOutReserve: "500_000",
    liquidityUSD: 2_500_000,
  };
  return [pool];
}

/** 获取近期交易记录 */
async function fetchRecentTrades(
  tokenIn: string,
  tokenOut: string,
  dex: string,
  lookbackMinutes = 30
): Promise<TradeRecord[]> {
  // TODO: 连接 DEX 子图或链上事件日志获取历史交易
  // 返回模拟数据
  const now = Date.now();
  return Array.from({ length: 50 }, (_, i) => ({
    amount: 100 + Math.random() * 10_000,
    timestamp: now - Math.random() * lookbackMinutes * 60 * 1000,
  }));
}

// ── 核心计算函数 ──────────────────────────────────────

/** 计算 P95 分位值 */
function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

/** 根据池子深度计算基础滑点（基于恒定乘积公式近似） */
function calcBaseSlippage(
  amountIn: number,
  reserveIn: number,
  reserveOut: number
): number {
  // x * y = k, 价格影响 ≈ Δx / x
  if (reserveIn <= 0) return 100; // 无流动性，给一个高值
  const priceImpact = amountIn / reserveIn;
  // 将价格影响换算为 bps，乘以安全系数 1.5
  return Math.max(5, Math.ceil(priceImpact * 10000 * 1.5));
}

/** 根据近期波动率计算波动滑点 */
function calcVolatilitySlippage(recentTrades: TradeRecord[]): number {
  if (recentTrades.length < 5) return 20; // 数据不足，保守 20 bps

  const amounts = recentTrades.map((t) => t.amount);
  const p95 = percentile95(amounts);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;

  // 波动率系数：如果 P95 交易量远大于均值，说明有大单在跑
  const ratio = mean > 0 ? p95 / mean : 1;
  if (ratio > 3) return 50;
  if (ratio > 2) return 30;
  return 15;
}

/** 综合计算推荐滑点 */
async function calcRecommendedSlippage(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  routeHint?: string;
}): Promise<{
  minSafeSlipBps: number;
  poolDepths: PoolDepth[];
  recentTradeSizeP95: number;
  breakdown: {
    baseSlippageBps: number;
    volatilitySlippageBps: number;
    gasBufferBps: number;
  };
}> {
  const { tokenIn, tokenOut, amountIn, routeHint } = params;

  // 1. 获取池子数据
  const pools = await fetchPoolDepths(tokenIn, tokenOut, routeHint);

  // 2. 如果没找到池子，给一个默认安全值
  if (pools.length === 0) {
    return {
      minSafeSlipBps: 100,
      poolDepths: [],
      recentTradeSizeP95: 0,
      breakdown: { baseSlippageBps: 50, volatilitySlippageBps: 30, gasBufferBps: 20 },
    };
  }

  // 取流动性最高的池子
  const deepestPool = pools.reduce((a, b) =>
    a.liquidityUSD > b.liquidityUSD ? a : b
  );

  // 3. 计算基础滑点
  const reserveIn = Number(deepestPool.tokenInReserve.replace(/_/g, ""));
  const reserveOut = Number(deepestPool.tokenOutReserve.replace(/_/g, ""));
  const baseSlippage = calcBaseSlippage(amountIn, reserveIn, reserveOut);

  // 4. 获取近期交易，计算波动滑点
  const trades = await fetchRecentTrades(tokenIn, tokenOut, deepestPool.dex);
  const volatilitySlippage = calcVolatilitySlippage(trades);
  const tradeSizeP95 = percentile95(trades.map((t) => t.amount));

  // 5. gas 缓冲（固定 5 bps 作为 gas 价格波动缓冲）
  const gasBufferBps = 5;

  // 6. 综合：取最大者 + 缓冲
  const minSafeSlipBps =
    Math.max(baseSlippage, volatilitySlippage) + gasBufferBps;

  return {
    minSafeSlipBps,
    poolDepths: pools,
    recentTradeSizeP95: tradeSizeP95,
    breakdown: {
      baseSlippageBps: baseSlippage,
      volatilitySlippageBps: volatilitySlippage,
      gasBufferBps,
    },
  };
}

// ── Agent Entrypoint ──────────────────────────────────

addEntrypoint({
  key: "estimate-slippage",
  description: "Estimate safe slippage tolerance for a specific swap route",
  input: z.object({
    token_in: z.string().describe("Input token address"),
    token_out: z.string().describe("Output token address"),
    amount_in: z.number().positive().describe("Amount to swap"),
    route_hint: z
      .string()
      .optional()
      .describe("Suggested route/DEX (optional)"),
  }),
  async handler({ input }) {
    const result = await calcRecommendedSlippage({
      tokenIn: input.token_in,
      tokenOut: input.token_out,
      amountIn: input.amount_in,
      routeHint: input.route_hint,
    });

    return {
      output: {
        min_safe_slip_bps: result.minSafeSlipBps,
        pool_depths: result.poolDepths.map((p) => ({
          dex: p.dex,
          token_in_reserve: p.tokenInReserve,
          token_out_reserve: p.tokenOutReserve,
          liquidity_usd: p.liquidityUSD,
        })),
        recent_trade_size_p95: result.recentTradeSizeP95,
        breakdown: result.breakdown,
      },
      usage: {
        total_tokens: JSON.stringify(input).length,
      },
    };
  },
});

addEntrypoint({
  key: "echo",
  description: "Echo a message (for testing)",
  input: z.object({ text: z.string() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "") },
      usage: { total_tokens: String(input.text ?? "").length },
    };
  },
});

export default app;
