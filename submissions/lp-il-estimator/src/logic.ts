// ---------------------------------------------------------------------------
// LP Impermanent Loss Estimator — Core Logic
// ---------------------------------------------------------------------------
//
// Uses the DexScreener API (free, no key) to find pools and fetch live data,
// then applies the constant-product AMM impermanent loss formula.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EstimateInput {
  pool_address?: string;
  token_a: string;
  token_b: string;
  deposit_value_usd: string;
  window_hours: number;
  chain: string;
  price_change_pct?: number;
}

interface PoolInfo {
  address: string;
  dex: string;
  chain: string;
  token_a: { symbol: string; address: string };
  token_b: { symbol: string; address: string };
  fee_tier: string;
  priceUsd: number;
  priceChange24h: number;
  priceChange6h: number;
  priceChange1h: number;
  volume24h: number;
  tvl: number;
  feeBps: number;
}

export interface EstimateOutput {
  pool: {
    address: string;
    dex: string;
    chain: string;
    token_a: { symbol: string; address: string };
    token_b: { symbol: string; address: string };
    fee_tier: string;
  };
  metrics: {
    il_percent: number;
    il_usd: string;
    fee_apr: number;
    fee_earned_usd: string;
    net_apr: number;
    volume_24h: string;
    tvl: string;
    price_change_pct: number;
  };
  simulation: {
    deposit_value_usd: string;
    current_lp_value_usd: string;
    hodl_value_usd: string;
    il_vs_hodl_usd: string;
    fees_earned_usd: string;
    net_value_usd: string;
  };
  notes: string[];
  queried_at: string;
}

// ---------------------------------------------------------------------------
// Chain ID mapping
// ---------------------------------------------------------------------------

const CHAIN_MAP: Record<string, string> = {
  ethereum: "ethereum",
  eth: "ethereum",
  base: "base",
  arbitrum: "arbitrum",
  polygon: "polygon",
  optimism: "optimism",
  bsc: "bsc",
  avalanche: "avalanche",
};

// ---------------------------------------------------------------------------
// Well-known token symbols → DexScreener search terms
// ---------------------------------------------------------------------------

const TOKEN_ALIASES: Record<string, string> = {
  ETH: "WETH",
  BTC: "WBTC",
};

function normalizeSymbol(s: string): string {
  const upper = s.toUpperCase();
  return TOKEN_ALIASES[upper] ?? upper;
}

// ---------------------------------------------------------------------------
// Fee tier extraction from DexScreener label
// ---------------------------------------------------------------------------

function extractFeeBps(dexLabel: string): number {
  // DexScreener pool labels often include fee like "Uniswap V3 0.3%"
  const match = dexLabel.match(/([\d.]+)\s*%/);
  if (match) return Math.round(parseFloat(match[1]) * 100); // percent → bps

  // Common defaults
  const lower = dexLabel.toLowerCase();
  if (lower.includes("v3")) return 30; // 0.30% default for V3
  if (lower.includes("v2") || lower.includes("sushi")) return 30; // 0.30%
  if (lower.includes("curve")) return 4; // 0.04% typical for Curve
  if (lower.includes("pancake")) return 25; // 0.25%
  return 30; // fallback
}

// ---------------------------------------------------------------------------
// DexScreener API
// ---------------------------------------------------------------------------

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  txns: {
    h24: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h1: { buys: number; sells: number };
  };
  volume: { h24: number; h6: number; h1: number };
  priceChange: { h24: number; h6: number; h1: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
}

async function searchPools(
  tokenA: string,
  tokenB: string,
  chain: string
): Promise<DexScreenerPair[]> {
  const symA = normalizeSymbol(tokenA);
  const symB = normalizeSymbol(tokenB);
  const query = `${symA} ${symB}`;

  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
  );

  if (!res.ok) {
    throw new Error(`DexScreener search failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { pairs?: DexScreenerPair[] };
  const pairs = data.pairs ?? [];

  const chainId = CHAIN_MAP[chain.toLowerCase()] ?? chain.toLowerCase();

  // Filter to matching chain and token pair
  return pairs.filter((p) => {
    if (p.chainId !== chainId) return false;
    const symbols = [
      p.baseToken.symbol.toUpperCase(),
      p.quoteToken.symbol.toUpperCase(),
    ];
    return symbols.includes(symA) && symbols.includes(symB);
  });
}

async function fetchPairByAddress(
  chain: string,
  address: string
): Promise<DexScreenerPair | null> {
  const chainId = CHAIN_MAP[chain.toLowerCase()] ?? chain.toLowerCase();
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${address}`
  );

  if (!res.ok) return null;

  const data = (await res.json()) as { pairs?: DexScreenerPair[] };
  return data.pairs?.[0] ?? null;
}

function pairToPoolInfo(pair: DexScreenerPair): PoolInfo {
  const feeBps = extractFeeBps(pair.dexId + " " + (pair.labels?.join(" ") ?? ""));

  return {
    address: pair.pairAddress,
    dex: pair.dexId,
    chain: pair.chainId,
    token_a: {
      symbol: pair.baseToken.symbol,
      address: pair.baseToken.address,
    },
    token_b: {
      symbol: pair.quoteToken.symbol,
      address: pair.quoteToken.address,
    },
    fee_tier: `${feeBps / 100}%`,
    priceUsd: parseFloat(pair.priceUsd) || 0,
    priceChange24h: pair.priceChange?.h24 ?? 0,
    priceChange6h: pair.priceChange?.h6 ?? 0,
    priceChange1h: pair.priceChange?.h1 ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    tvl: pair.liquidity?.usd ?? 0,
    feeBps,
  };
}

// ---------------------------------------------------------------------------
// Impermanent Loss Math
// ---------------------------------------------------------------------------

/**
 * Calculate impermanent loss for a constant-product (50/50) AMM.
 *
 *   IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
 *
 * where priceRatio = currentPrice / entryPrice.
 * Result is always <= 0 (a loss relative to holding).
 *
 * @param priceChangePct — price change of token_a vs token_b in percent
 *                          e.g. 50 means token_a went up 50%
 * @returns IL as a decimal (e.g. -0.02 means 2% loss)
 */
function calcImpermanentLoss(priceChangePct: number): number {
  const priceRatio = 1 + priceChangePct / 100;
  if (priceRatio <= 0) return -1; // total loss if price goes to 0

  const sqrtRatio = Math.sqrt(priceRatio);
  return (2 * sqrtRatio) / (1 + priceRatio) - 1;
}

/**
 * Annualize a rate earned over a specific window.
 * @param rate — rate earned in the window (e.g. 0.005 = 0.5%)
 * @param windowHours — length of the window in hours
 * @returns annualized rate as a percentage (e.g. 26.07)
 */
function annualizeRate(rate: number, windowHours: number): number {
  if (windowHours <= 0) return 0;
  const hoursPerYear = 8760;
  return (rate * hoursPerYear) / windowHours * 100;
}

// ---------------------------------------------------------------------------
// Main estimation function
// ---------------------------------------------------------------------------

export async function estimateIL(input: EstimateInput): Promise<EstimateOutput> {
  const notes: string[] = [];
  let pool: PoolInfo;

  // 1. Find or fetch pool
  if (input.pool_address) {
    const pair = await fetchPairByAddress(input.chain, input.pool_address);
    if (!pair) {
      throw new Error(
        `Pool ${input.pool_address} not found on ${input.chain} via DexScreener`
      );
    }
    pool = pairToPoolInfo(pair);
  } else {
    const pairs = await searchPools(input.token_a, input.token_b, input.chain);
    if (pairs.length === 0) {
      throw new Error(
        `No pools found for ${input.token_a}/${input.token_b} on ${input.chain}`
      );
    }
    // Pick the highest-TVL pool
    pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    pool = pairToPoolInfo(pairs[0]);
    if (pairs.length > 1) {
      notes.push(
        `Found ${pairs.length} pools; selected ${pool.dex} (${pool.fee_tier}) with highest TVL ($${pool.tvl.toLocaleString()})`
      );
    }
  }

  // 2. Determine price change
  let priceChangePct: number;
  if (input.price_change_pct !== undefined) {
    priceChangePct = input.price_change_pct;
    notes.push(
      `Using simulated price change of ${priceChangePct}% (user-specified)`
    );
  } else {
    // Use the 24h price change from DexScreener as proxy
    priceChangePct = pool.priceChange24h;
    notes.push(
      `Using historical 24h price change of ${priceChangePct.toFixed(2)}% from DexScreener`
    );
  }

  // 3. Calculate impermanent loss
  const ilDecimal = calcImpermanentLoss(priceChangePct);
  const ilPercent = Math.round(ilDecimal * 10000) / 100; // round to 2 decimals

  // 4. Calculate fee APR
  // daily_fees = volume_24h * fee_tier_decimal
  // fee_apr = (daily_fees / tvl) * 365
  const dailyFees =
    pool.volume24h * (pool.feeBps / 10000);
  const feeRateDaily = pool.tvl > 0 ? dailyFees / pool.tvl : 0;
  const feeApr = feeRateDaily * 365 * 100;

  // Fee earned in the window
  const windowDays = input.window_hours / 24;
  const depositUsd = parseFloat(input.deposit_value_usd);
  const feeEarnedUsd = depositUsd * feeRateDaily * windowDays;

  // 5. Net APR (fee APR minus annualized IL)
  const ilAnnualized = annualizeRate(Math.abs(ilDecimal), input.window_hours);
  const netApr = feeApr - ilAnnualized;

  // 6. Simulation
  // HODL: split 50/50 at entry. Token A side appreciates by priceChangePct.
  const halfDeposit = depositUsd / 2;
  const hodlValueA = halfDeposit * (1 + priceChangePct / 100);
  const hodlValueB = halfDeposit; // stablecoin or denominator doesn't change relative to itself
  const hodlTotal = hodlValueA + hodlValueB;

  // LP value: deposit * (1 + IL)
  const lpValue = depositUsd * (1 + ilDecimal);

  // Net = LP + fees
  const netValue = lpValue + feeEarnedUsd;
  const ilVsHodl = lpValue - hodlTotal;
  const ilUsd = depositUsd * ilDecimal;

  return {
    pool: {
      address: pool.address,
      dex: pool.dex,
      chain: pool.chain,
      token_a: pool.token_a,
      token_b: pool.token_b,
      fee_tier: pool.fee_tier,
    },
    metrics: {
      il_percent: ilPercent,
      il_usd: `$${ilUsd.toFixed(2)}`,
      fee_apr: Math.round(feeApr * 100) / 100,
      fee_earned_usd: `$${feeEarnedUsd.toFixed(2)}`,
      net_apr: Math.round(netApr * 100) / 100,
      volume_24h: `$${pool.volume24h.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      tvl: `$${pool.tvl.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      price_change_pct: Math.round(priceChangePct * 100) / 100,
    },
    simulation: {
      deposit_value_usd: `$${depositUsd.toLocaleString()}`,
      current_lp_value_usd: `$${lpValue.toFixed(2)}`,
      hodl_value_usd: `$${hodlTotal.toFixed(2)}`,
      il_vs_hodl_usd: `$${ilVsHodl.toFixed(2)}`,
      fees_earned_usd: `$${feeEarnedUsd.toFixed(2)}`,
      net_value_usd: `$${netValue.toFixed(2)}`,
    },
    notes,
    queried_at: new Date().toISOString(),
  };
}
