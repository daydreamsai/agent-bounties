import { z } from "zod/v4";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp(
  {
    name: "lp-impermanent-loss-estimator",
    version: "0.1.0",
    description:
      "Calculate IL and fee APR for any LP position or simulated deposit",
  },
  {
    config: {
      payments: false,
    },
  }
);

// --- Types ---

interface PoolInfo {
  address: string;
  chain: string;
  protocol: string;
  pair: string;
  tvl: number;
  volume24h: number;
  fee: number;
  token0: string;
  token1: string;
  reserve0: number;
  reserve1: number;
  price0: number;
  price1: number;
}

interface HistoricalPrice {
  timestamp: number;
  price: number;
}

// --- DeFiLlama API helpers ---

async function fetchPoolInfo(poolAddress: string, chain: string): Promise<PoolInfo | null> {
  try {
    // DeFiLlama pools endpoint
    const url = `https://coins.llama.fi/prices/current/${chain}:${poolAddress}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const coinKey = `${chain}:${poolAddress}`;
    const coin = data.coins?.[coinKey];
    if (!coin) return null;
    return {
      address: poolAddress,
      chain,
      protocol: "decentralized",
      pair: coin.symbol || "UNKNOWN",
      tvl: 0,
      volume24h: 0,
      fee: 0.003,
      token0: coin.symbol || "TOKEN",
      token1: "USD",
      reserve0: coin.price || 0,
      reserve1: 1,
      price0: coin.price || 0,
      price1: 1,
    };
  } catch {
    return null;
  }
}

async function fetchHistoricalPrices(
  tokenAddress: string,
  chain: string,
  hours: number
): Promise<HistoricalPrice[]> {
  try {
    const timestamp = Math.floor(Date.now() / 1000) - hours * 3600;
    const url = `https://coins.llama.fi/prices/historical/${timestamp}/${chain}:${tokenAddress}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const coinKey = `${chain}:${tokenAddress}`;
    const coin = data.coins?.[coinKey];
    if (!coin || !Array.isArray(coin.prices)) return [];
    return coin.prices.map((p: [number, number]) => ({
      timestamp: p[0],
      price: p[1],
    }));
  } catch {
    return [];
  }
}

// --- DeFiLlama pools API ---

async function fetchPoolDetails(poolAddress: string): Promise<PoolInfo | null> {
  try {
    const url = `https://yields.llama.fi/pool/${poolAddress}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.data) return null;
    const pool = data.data;
    return {
      address: poolAddress,
      chain: pool.chain || "ethereum",
      protocol: pool.project || "unknown",
      pair: pool.pool || pool.symbol || "UNKNOWN",
      tvl: pool.tvl || 0,
      volume24h: pool.volumeUsd24h || 0,
      fee: (pool.apyBase || 0) / 100 || 0.003,
      token0: pool.underlyingTokens?.[0] || "TOKEN0",
      token1: pool.underlyingTokens?.[1] || "TOKEN1",
      reserve0: 0,
      reserve1: 0,
      price0: 0,
      price1: 0,
    };
  } catch {
    return null;
  }
}

// --- Math helpers ---

function calcImpermanentLoss(
  priceRatioChange: number // e.g., 2.0 means price doubled
): number {
  if (priceRatioChange <= 0) return 0;
  const sqrt = Math.sqrt(priceRatioChange);
  return 2 * sqrt / (1 + priceRatioChange) - 1;
}

function calcV3IL(
  priceLower: number,
  priceUpper: number,
  currentPrice: number,
  newPrice: number
): number {
  // For concentrated liquidity: position value = value of range-bound position
  // Simplified approximation using the ratio of how much of the range is covered
  
  if (newPrice <= priceLower || newPrice >= priceUpper) {
    // Price moved out of range - full IL exposure
    const ratio = newPrice / currentPrice;
    return 2 * Math.sqrt(ratio) / (1 + ratio) - 1;
  }
  
  // Within range: diluted IL
  const range = Math.log(priceUpper / priceLower);
  const position = Math.log(newPrice / currentPrice);
  const dilution = Math.min(1, Math.abs(position) / (range * 0.5));
  const baseIL = 2 * Math.sqrt(newPrice / currentPrice) / (1 + newPrice / currentPrice) - 1;
  
  return baseIL * dilution;
}

function calcFeeAPR(
  volume24h: number,
  tvl: number,
  feeRate: number,
  sharePct: number
): number {
  if (tvl <= 0 || volume24h <= 0) return 0;
  // Fee APR = (daily volume * fee rate * your share of pool) / your deposit * 365
  const dailyFees = volume24h * feeRate;
  const yourDailyFees = dailyFees * (sharePct / 100);
  const yourDeposit = tvl * (sharePct / 100);
  if (yourDeposit <= 0) return 0;
  return (yourDailyFees / yourDeposit) * 365 * 100;
}

// --- Entrypoint: calculate IL ---

addEntrypoint({
  key: "il-calculate",
  description:
    "Calculate impermanent loss for a given price change scenario. Provide expected price ratio or both initial and current prices.",
  input: z.object({
    pool_address: z.string().optional().describe("LP pool address (optional for simulated)"),
    chain: z.string().optional().default("ethereum").describe("Blockchain (ethereum, polygon, etc.)"),
    token_weights: z.array(z.number()).optional().describe("Token weight distribution (e.g., [0.5, 0.5])"),
    deposit_amounts: z.array(z.number()).optional().describe("Amount of each token deposited"),
    initial_price_ratio: z.number().optional().describe("Initial price ratio (token1/token0)"),
    current_price_ratio: z.number().optional().describe("Current/expected price ratio (token1/token0)"),
    price_change_pct: z.number().optional().describe("Price change percentage (e.g., 50 for 50% increase, -30 for 30% decrease)"),
    window_hours: z.number().optional().default(24).describe("Historical window for calculation"),
    v3_min_price: z.number().optional().describe("V3 concentrated liquidity lower bound"),
    v3_max_price: z.number().optional().describe("V3 concentrated liquidity upper bound"),
  }),
  async handler({ input }) {
    const startTime = Date.now();

    // Determine price ratio
    let initialPrice = input.initial_price_ratio;
    let currentPrice = input.current_price_ratio;

    // If price_change_pct is given, calculate current price
    if (input.price_change_pct !== undefined && initialPrice !== undefined) {
      currentPrice = initialPrice * (1 + input.price_change_pct / 100);
    }

    // If pool_address provided, try to fetch real data
    let poolInfo: PoolInfo | null = null;
    if (input.pool_address) {
      poolInfo = await fetchPoolDetails(input.pool_address);
      if (!poolInfo) {
        poolInfo = await fetchPoolInfo(input.pool_address, input.chain || "ethereum");
      }
    }

    // If no prices provided but pool has data, use on-chain prices
    if (!initialPrice && poolInfo && poolInfo.price0 > 0 && poolInfo.price1 > 0) {
      initialPrice = poolInfo.price1 / poolInfo.price0;
    }

    // Default: assume 1:1 starting ratio
    if (!initialPrice) initialPrice = 1.0;
    if (!currentPrice) currentPrice = initialPrice;

    const priceRatioChange = currentPrice / initialPrice;

    // Calculate IL
    let ilPercent: number;
    if (input.v3_min_price && input.v3_max_price) {
      ilPercent = calcV3IL(
        input.v3_min_price,
        input.v3_max_price,
        initialPrice,
        currentPrice
      );
    } else {
      ilPercent = calcImpermanentLoss(priceRatioChange);
    }

    // Calculate fee APR estimate
    let feeAprEst = 0;
    let volumeWindow = 0;
    if (poolInfo && poolInfo.volume24h > 0 && poolInfo.tvl > 0) {
      const defaultShare = 0.1; // Assume 0.1% of pool
      feeAprEst = calcFeeAPR(poolInfo.volume24h, poolInfo.tvl, poolInfo.fee, defaultShare);
      volumeWindow = poolInfo.volume24h;
    } else if (input.deposit_amounts && input.token_weights && poolInfo) {
      // Estimate from deposit amounts
      const totalDeposit = input.deposit_amounts.reduce((a: number, b: number) => a + b, 0);
      if (poolInfo.tvl > 0) {
        const sharePct = (totalDeposit / poolInfo.tvl) * 100;
        feeAprEst = calcFeeAPR(poolInfo.volume24h || 100000, poolInfo.tvl, poolInfo.fee, sharePct);
      }
    }

    // Generate notes
    const notes: string[] = [];
    if (ilPercent < 0) {
      notes.push(`Impermanent loss of ${Math.abs(ilPercent * 100).toFixed(2)}% relative to holding`);
    } else if (ilPercent > 0) {
      notes.push(`Gain of ${(ilPercent * 100).toFixed(2)}% vs holding (price moved back toward entry)`);
    }
    if (Math.abs(priceRatioChange - 1) > 1) {
      notes.push("⚠️ Large price change detected — IL is significant");
    }
    if (poolInfo) {
      notes.push(`Pool: ${poolInfo.pair} on ${poolInfo.chain} (${poolInfo.protocol})`);
      if (poolInfo.tvl > 0) notes.push(`TVL: $${poolInfo.tvl.toLocaleString()}`);
    }
    if (input.price_change_pct !== undefined) {
      notes.push(`Scenario: ${input.price_change_pct >= 0 ? '+' : ''}${input.price_change_pct}% price change`);
    }
    if (input.v3_min_price && input.v3_max_price) {
      notes.push(`V3 concentrated range: [${input.v3_min_price}, ${input.v3_max_price}]`);
    }

    const usage = { total_tokens: JSON.stringify(input).length + JSON.stringify({ ilPercent, feeAprEst }).length };

    return {
      output: {
        IL_percent: parseFloat((ilPercent * 100).toFixed(4)),
        fee_apr_est: parseFloat(feeAprEst.toFixed(2)),
        volume_window: volumeWindow,
        price_ratio_change: parseFloat(priceRatioChange.toFixed(6)),
        initial_price_ratio: parseFloat(initialPrice.toFixed(8)),
        current_price_ratio: parseFloat(currentPrice.toFixed(8)),
        notes: notes.join(" | "),
        meta: {
          processing_time_ms: Date.now() - startTime,
          pool_info: poolInfo
            ? {
                address: poolInfo.address,
                chain: poolInfo.chain,
                protocol: poolInfo.protocol,
                pair: poolInfo.pair,
                tvl: poolInfo.tvl,
                volume24h: poolInfo.volume24h,
                fee_rate: poolInfo.fee,
              }
            : null,
        },
      },
      usage,
    };
  },
});

// --- Entrypoint: batch estimate ---

addEntrypoint({
  key: "estimate",
  description:
    "Run multiple IL scenarios from a list of price change assumptions and return a comparison table.",
  input: z.object({
    pool_address: z.string().optional(),
    initial_price_ratio: z.number().optional().default(1.0),
    price_changes: z.array(z.number()).describe("Array of price change percentages, e.g., [-50, -25, 25, 50, 100, 200]"),
    window_hours: z.number().optional().default(24),
  }),
  async handler({ input }) {
    const startTime = Date.now();
    const initialPrice = input.initial_price_ratio ?? 1.0;
    const scenarios = [];

    for (const change of input.price_changes) {
      const currentPrice = initialPrice * (1 + change / 100);
      const priceRatioChange = currentPrice / initialPrice;
      const il = calcImpermanentLoss(priceRatioChange);

      scenarios.push({
        price_change_pct: change,
        current_price_ratio: parseFloat(currentPrice.toFixed(8)),
        il_percent: parseFloat((il * 100).toFixed(4)),
      });
    }

    return {
      output: {
        scenarios,
        count: scenarios.length,
        timestamp: new Date().toISOString(),
        summary: {
          max_il: Math.min(...scenarios.map((s: { il_percent: number }) => s.il_percent)).toFixed(2) + "%",
          worst_case: scenarios.reduce((a: { il_percent: number }, b: { il_percent: number }) =>
            a.il_percent < b.il_percent ? a : b
          ),
        },
      },
      usage: { total_tokens: JSON.stringify(scenarios).length + 100 },
    };
  },
});

export default app;
