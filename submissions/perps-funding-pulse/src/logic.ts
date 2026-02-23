import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FundingMetrics = {
  venue: string;
  market: string;
  funding_rate: number;
  funding_rate_annualized: number;
  time_to_next: string;
  time_to_next_seconds: number;
  open_interest: number;
  open_interest_notional: string;
  skew: number;
  skew_direction: string;
  mark_price: string;
  oracle_price: string;
  day_volume: string;
  premium: string;
};

export type FundingResponse = {
  markets: FundingMetrics[];
  venue_count: number;
  timestamp: string;
  summary: string;
};

// ---------------------------------------------------------------------------
// Hyperliquid
// ---------------------------------------------------------------------------

const HYPERLIQUID_INFO = "https://api.hyperliquid.xyz/info";

type HyperliquidMeta = {
  universe: Array<{
    name: string;
    szDecimals: number;
    maxLeverage: number;
  }>;
};

type HyperliquidAssetCtx = {
  funding: string;
  openInterest: string;
  dayNtlVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
  prevDayPx: string;
  impactPxs: [string, string];
};

async function fetchHyperliquidData(): Promise<[HyperliquidMeta, HyperliquidAssetCtx[]]> {
  const res = await fetch(HYPERLIQUID_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
  });

  if (!res.ok) {
    throw new Error(`Hyperliquid API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data as [HyperliquidMeta, HyperliquidAssetCtx[]];
}

/**
 * Hyperliquid funds every hour on the hour. Compute seconds until the next
 * funding tick.
 */
function secondsToNextFunding(): number {
  const now = Date.now();
  const msPerHour = 3_600_000;
  const nextHour = Math.ceil(now / msPerHour) * msPerHour;
  return Math.max(0, Math.round((nextHour - now) / 1000));
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}

/**
 * Derive a long/short skew ratio from Hyperliquid impact prices.
 *
 * Impact prices represent the prices achieved by a standardised notional
 * order on either side of the book. A wider spread between the buy-impact
 * and sell-impact prices relative to mid indicates directional positioning.
 *
 * We compute:
 *   skew = (buyImpact - mid) / (mid - sellImpact)
 *
 * A value > 1.0 implies net-long positioning (heavier buying pressure),
 * < 1.0 implies net-short, and ~1.0 implies balanced.
 *
 * When the denominator is negligibly small we fall back to a funding-rate
 * heuristic: positive funding implies more longs, negative implies shorts.
 */
function computeSkew(ctx: HyperliquidAssetCtx): { ratio: number; direction: string } {
  const mid = parseFloat(ctx.midPx);
  const buyImpact = parseFloat(ctx.impactPxs?.[0] ?? ctx.midPx);
  const sellImpact = parseFloat(ctx.impactPxs?.[1] ?? ctx.midPx);

  const buyDelta = buyImpact - mid;
  const sellDelta = mid - sellImpact;

  let ratio: number;
  if (sellDelta > 0 && buyDelta >= 0) {
    ratio = Math.round((buyDelta / sellDelta) * 1000) / 1000;
  } else {
    // Fallback: use funding direction as a proxy
    const funding = parseFloat(ctx.funding);
    ratio = funding > 0 ? 1.1 : funding < 0 ? 0.9 : 1.0;
  }

  const direction =
    ratio > 1.05 ? "net-long" : ratio < 0.95 ? "net-short" : "balanced";

  return { ratio, direction };
}

async function getHyperliquidMetrics(
  requestedMarkets: string[]
): Promise<FundingMetrics[]> {
  const [meta, contexts] = await fetchHyperliquidData();
  const universe = meta.universe;

  // Normalise requested markets to uppercase and strip common suffixes
  const normalised = requestedMarkets.map((m) =>
    m.toUpperCase().replace(/[-/]?PERP$/i, "").replace(/[-/]?USD[T]?$/i, "")
  );

  const results: FundingMetrics[] = [];
  const ttNext = secondsToNextFunding();

  for (let i = 0; i < universe.length; i++) {
    const asset = universe[i];
    const ctx = contexts[i];
    if (!ctx) continue;

    // Match by canonical name (e.g. "BTC", "ETH")
    const upperName = asset.name.toUpperCase();
    if (
      normalised.length > 0 &&
      !normalised.some(
        (n) => upperName === n || upperName.startsWith(n)
      )
    ) {
      continue;
    }

    const fundingRate = parseFloat(ctx.funding);
    const markPrice = parseFloat(ctx.markPx);
    const oiNotional = parseFloat(ctx.openInterest);
    const { ratio, direction } = computeSkew(ctx);

    results.push({
      venue: "hyperliquid",
      market: `${asset.name}-PERP`,
      funding_rate: fundingRate,
      funding_rate_annualized:
        Math.round(fundingRate * 8760 * 10000) / 100, // hourly -> annual %
      time_to_next: formatDuration(ttNext),
      time_to_next_seconds: ttNext,
      open_interest: oiNotional,
      open_interest_notional: `$${(oiNotional * markPrice).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      skew: ratio,
      skew_direction: direction,
      mark_price: ctx.markPx,
      oracle_price: ctx.oraclePx,
      day_volume: `$${parseFloat(ctx.dayNtlVlm).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      premium: ctx.premium,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// On-chain Uniswap V3 comparison (ETH-USDC 0.05% pool on mainnet)
// ---------------------------------------------------------------------------

const UNISWAP_V3_POOL = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640" as const; // ETH/USDC 0.05%

const POOL_ABI = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
]);

function getMainnetClient() {
  const rpcUrl = process.env.ETH_RPC_URL || "https://eth.llamarpc.com";
  return createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
}

/**
 * Fetch a single spot reference point from Uniswap V3 for ETH/USDC.
 * This provides a DeFi-native price reference to compare against the
 * Hyperliquid perp mark/oracle prices.
 */
async function getUniswapReference(): Promise<{
  spot_price: string;
  pool_liquidity: string;
} | null> {
  try {
    const client = getMainnetClient();

    const [slot0Result, liquidityResult] = await Promise.all([
      client.readContract({
        address: UNISWAP_V3_POOL,
        abi: POOL_ABI,
        functionName: "slot0",
      }),
      client.readContract({
        address: UNISWAP_V3_POOL,
        abi: POOL_ABI,
        functionName: "liquidity",
      }),
    ]);

    const sqrtPriceX96 = slot0Result[0];
    // price = (sqrtPriceX96 / 2^96)^2 adjusted for decimals (USDC 6, WETH 18)
    const sqrtPrice = Number(sqrtPriceX96) / 2 ** 96;
    const rawPrice = sqrtPrice * sqrtPrice;
    // Pool is token0=USDC(6 dec), token1=WETH(18 dec)
    // rawPrice = USDC per WETH in base units = (USDC_units / WETH_units)
    // Adjust for decimal difference: multiply by 10^(18-6) = 10^12
    const ethPrice = 1 / (rawPrice * 1e12);

    return {
      spot_price: ethPrice.toFixed(2),
      pool_liquidity: liquidityResult.toString(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchFundingData(
  venueIds: string[],
  markets: string[]
): Promise<FundingResponse> {
  const allMetrics: FundingMetrics[] = [];

  // Normalise venue list
  const venues = venueIds.map((v) => v.toLowerCase());
  const useHyperliquid =
    venues.length === 0 || venues.includes("hyperliquid") || venues.includes("hl");

  if (useHyperliquid) {
    try {
      const hlMetrics = await getHyperliquidMetrics(markets);
      allMetrics.push(...hlMetrics);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Return a degraded result rather than failing completely
      allMetrics.push({
        venue: "hyperliquid",
        market: markets.join(",") || "ALL",
        funding_rate: 0,
        funding_rate_annualized: 0,
        time_to_next: "N/A",
        time_to_next_seconds: 0,
        open_interest: 0,
        open_interest_notional: "$0",
        skew: 1.0,
        skew_direction: "unknown",
        mark_price: "0",
        oracle_price: "0",
        day_volume: "$0",
        premium: "0",
      });
      console.error(`[perps-funding-pulse] Hyperliquid fetch failed: ${message}`);
    }
  }

  // Attach Uniswap V3 on-chain spot reference for ETH if requested markets
  // include ETH (or no specific markets were requested)
  const wantEth =
    markets.length === 0 ||
    markets.some((m) => /^ETH/i.test(m));

  let uniRef: { spot_price: string; pool_liquidity: string } | null = null;
  if (wantEth) {
    uniRef = await getUniswapReference();
  }

  const venueCount = new Set(allMetrics.map((m) => m.venue)).size;
  const summaryParts: string[] = [
    `Fetched ${allMetrics.length} market(s) from ${venueCount} venue(s).`,
  ];

  if (uniRef) {
    summaryParts.push(
      `Uniswap V3 ETH/USDC spot reference: $${uniRef.spot_price} (liquidity: ${uniRef.pool_liquidity}).`
    );
  }

  // Highlight extreme funding rates
  const extremes = allMetrics.filter(
    (m) => Math.abs(m.funding_rate_annualized) > 50
  );
  if (extremes.length > 0) {
    summaryParts.push(
      `${extremes.length} market(s) with annualized funding >50%: ${extremes.map((e) => `${e.market} (${e.funding_rate_annualized}%)`).join(", ")}.`
    );
  }

  return {
    markets: allMetrics,
    venue_count: venueCount,
    timestamp: new Date().toISOString(),
    summary: summaryParts.join(" "),
  };
}
