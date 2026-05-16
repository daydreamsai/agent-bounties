import {
  type FundingPulseInput,
  type FundingPulseOutput,
  type MarketFunding,
  type FundingRatePoint,
  type ArbitrageOpportunity,
  type VenueId,
} from "./types";

/**
 * Venue metadata: funding interval, base fee, and default markets.
 */
interface VenueMeta {
  id: VenueId;
  name: string;
  fundingIntervalHours: number;
  defaultMarkets: string[];
  supportedTokens: string[];
}

const VENUE_META: VenueMeta[] = [
  {
    id: "gmx",
    name: "GMX V1",
    fundingIntervalHours: 8,
    defaultMarkets: ["ETH-USD", "BTC-USD", "LINK-USD", "UNI-USD", "ARB-USD"],
    supportedTokens: ["ETH", "BTC", "LINK", "UNI", "ARB", "SOL", "AVAX"],
  },
  {
    id: "gmx_v2",
    name: "GMX V2",
    fundingIntervalHours: 8,
    defaultMarkets: ["ETH-USD", "BTC-USD", "SOL-USD", "ARB-USD", "LINK-USD"],
    supportedTokens: ["ETH", "BTC", "SOL", "ARB", "LINK", "AVAX"],
  },
  {
    id: "dydx_v4",
    name: "dYdX V4",
    fundingIntervalHours: 1,
    defaultMarkets: [
      "ETH-USD", "BTC-USD", "SOL-USD", "LINK-USD", "AVAX-USD",
      "MATIC-USD", "DOGE-USD", "ARB-USD", "OP-USD",
    ],
    supportedTokens: [
      "ETH", "BTC", "SOL", "LINK", "AVAX", "MATIC", "DOGE", "ARB", "OP",
      "ATOM", "CRV", "LTC", "BCH",
    ],
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    fundingIntervalHours: 1,
    defaultMarkets: [
      "ETH-USD", "BTC-USD", "SOL-USD", "ARB-USD", "OP-USD",
      "LINK-USD", "SUI-USD", "TIA-USD", "HYPE-USD",
    ],
    supportedTokens: [
      "ETH", "BTC", "SOL", "ARB", "OP", "LINK", "SUI", "TIA", "HYPE",
      "SEI", "APT", "WIF", "JUP", "ENA",
    ],
  },
  {
    id: "drift",
    name: "Drift Protocol",
    fundingIntervalHours: 1,
    defaultMarkets: ["BTC-PERP", "ETH-PERP", "SOL-PERP", "ARB-PERP", "JUP-PERP"],
    supportedTokens: ["BTC", "ETH", "SOL", "ARB", "JUP", "BONK"],
  },
  {
    id: "perpetual_protocol",
    name: "Perpetual Protocol",
    fundingIntervalHours: 8,
    defaultMarkets: ["ETH-USD", "BTC-USD", "MATIC-USD", "ARB-USD"],
    supportedTokens: ["ETH", "BTC", "MATIC", "ARB", "OP"],
  },
  {
    id: "apex",
    name: "ApeX Protocol",
    fundingIntervalHours: 8,
    defaultMarkets: ["ETH-USDC", "BTC-USDC", "SOL-USDC"],
    supportedTokens: ["ETH", "BTC", "SOL", "AVAX"],
  },
  {
    id: "zeta",
    name: "Zeta Markets",
    fundingIntervalHours: 1,
    defaultMarkets: ["SOL-PERP", "ETH-PERP", "BTC-PERP", "JUP-PERP"],
    supportedTokens: ["SOL", "ETH", "BTC", "JUP", "PYTH", "WIF"],
  },
  {
    id: "mango_markets",
    name: "Mango Markets",
    fundingIntervalHours: 1,
    defaultMarkets: ["BTC-PERP", "ETH-PERP", "SOL-PERP", "MNGO-PERP"],
    supportedTokens: ["BTC", "ETH", "SOL", "MNGO"],
  },
  {
    id: "kwenta",
    name: "Kwenta",
    fundingIntervalHours: 8,
    defaultMarkets: ["sETH", "sBTC", "sLINK", "sSOL"],
    supportedTokens: ["ETH", "BTC", "LINK", "SOL", "AVAX", "MATIC"],
  },
  {
    id: "synthetix_v3",
    name: "Synthetix V3",
    fundingIntervalHours: 8,
    defaultMarkets: ["sETH-PERP", "sBTC-PERP", "sSOL-PERP"],
    supportedTokens: ["ETH", "BTC", "SOL", "LINK"],
  },
];

/**
 * Deterministic pseudo-rate for a given venue + market + hour.
 * Real implementation would query on-chain data or DEX APIs.
 */
function getFundingRate(
  venue: VenueId,
  market: string,
  extremeThreshold: number
): { rate: number; oi: number; skew: number } {
  const hour = new Date().getHours();
  // Seed from venue + market + hour for deterministic variety
  const seedBase = `${venue}_${market}`.length + hour;
  const r = Math.sin(seedBase * 12.9898) * 0.5 + 0.5;

  // Most rates are moderate, some are extreme
  const isExtreme = r > 0.9 || r < 0.1;
  let rate: number;
  if (isExtreme) {
    rate = r > 0.9
      ? extremeThreshold * (1 + r * 2)     // Extreme positive
      : -(extremeThreshold * (1 + (1 - r) * 2)); // Extreme negative
  } else {
    rate = (r - 0.5) * extremeThreshold * 1.5;
  }

  // Open interest
  const baseOI = 1_000_000 + Math.abs(seedBase) * 500_000;
  const oi = Math.round(baseOI * (0.7 + r * 0.6));

  // Long/short skew
  const skew = 0.5 + r; // 0.5 to 1.5

  return {
    rate: Math.round(rate * 10000) / 10000,
    oi,
    skew: Math.round(skew * 100) / 100,
  };
}

/**
 * Generate historical funding rate points.
 */
function generateHistory(
  venue: VenueId,
  market: string,
  lookbackHours: number,
  extremeThreshold: number
): FundingRatePoint[] {
  const now = Date.now();
  const points: FundingRatePoint[] = [];

  for (let h = 0; h < lookbackHours; h++) {
    const { rate, oi } = getFundingRate(venue, market, extremeThreshold);
    const ts = now - (lookbackHours - h) * 3600_000;

    points.push({
      timestamp: ts,
      rate,
      rate_8h: rate * 8,
      rate_annual: Math.round(rate * 365 * 24 * 100) / 100,
      open_interest: oi,
      mark_price: 2000 + Math.sin(ts / 10000) * 100,
      index_price: 2000 + Math.sin(ts / 10000) * 99,
    });
  }

  return points;
}

/**
 * Calculate rate volatility (std dev) over the lookback window.
 */
function calculateVolatility(history: FundingRatePoint[]): number {
  if (history.length < 2) return 0;
  const rates = history.map((p) => p.rate);
  const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
  const variance =
    rates.reduce((s, r) => s + (r - mean) ** 2, 0) / (rates.length - 1);
  return Math.round(Math.sqrt(variance) * 10000) / 100;
}

/**
 * Find arbitrage opportunities between venues for the same market.
 */
function findArbitrageOpportunities(
  markets: MarketFunding[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  // Group by base market (strip venue-specific prefixes)
  const byMarket: Map<string, MarketFunding[]> = new Map();

  for (const m of markets) {
    // Normalize market name to base
    const base = normalizeMarket(m.market);
    const existing = byMarket.get(base) || [];
    existing.push(m);
    byMarket.set(base, existing);
  }

  // For each market, find rate spreads between venues
  for (const [baseMarket, funds] of byMarket) {
    if (funds.length < 2) continue;

    for (let i = 0; i < funds.length; i++) {
      for (let j = i + 1; j < funds.length; j++) {
        const a = funds[i];
        const b = funds[j];

        // Spread in basis points (annualized)
        const aAnnual = a.funding_rate * 365 * 24;
        const bAnnual = b.funding_rate * 365 * 24;
        const spread = Math.abs(aAnnual - bAnnual) * 100;

        // Only flag meaningful spreads (>10 bps annualized)
        if (spread < 10) continue;

        // Determine which to long and short
        const [longFund, shortFund] = aAnnual > bAnnual
          ? [a, b]  // Long high-rate, short low-rate
          : [b, a];

        const estAPR = Math.abs(longFund.funding_rate - shortFund.funding_rate) * 365 * 24;

        opportunities.push({
          base_market: baseMarket,
          long_venue: longFund.venue,
          long_rate: longFund.funding_rate,
          short_venue: shortFund.venue,
          short_rate: shortFund.funding_rate,
          spread_bps: Math.round(spread * 100) / 100,
          estimated_apr: Math.round(estAPR * 10000) / 100,
          hedge_ratio: 1.0,
          notes: [
            `Long ${longFund.venue} (pay ${(longFund.funding_rate * 365 * 24 * 100).toFixed(2)}% APR)`,
            `Short ${shortFund.venue} (receive ${(shortFund.funding_rate * 365 * 24 * 100).toFixed(2)}% APR)`,
            `Net funding APR: ${(estAPR * 100).toFixed(2)}%`,
          ],
        });
      }
    }
  }

  // Sort by highest spread
  opportunities.sort((a, b) => b.spread_bps - a.spread_bps);

  return opportunities.slice(0, 10); // Top 10
}

/**
 * Normalize market names to a base pair.
 */
function normalizeMarket(market: string): string {
  return market
    .replace(/^s/, "")        // Remove Synthetix s- prefix
    .replace(/-PERP$/i, "")    // Remove -PERP suffix
    .replace(/-USD$/i, "")     // Remove -USD suffix
    .replace(/-USDC$/i, "")    // Remove -USDC suffix
    .toUpperCase();
}

/**
 * Main funding pulse function.
 */
export async function getFundingPulse(
  input: FundingPulseInput
): Promise<FundingPulseOutput> {
  const { venue_ids, markets, extreme_threshold, lookback_hours } = input;

  const marketFundings: MarketFunding[] = [];
  const extremeAlerts: string[] = [];

  for (const venueId of venue_ids) {
    const venueMeta = VENUE_META.find((v) => v.id === venueId);
    if (!venueMeta) continue;

    // Use specified markets or venue defaults
    const venueMarkets = markets.length > 0
      ? markets.filter((m) =>
          venueMeta.supportedTokens.some((t) =>
            normalizeMarket(m).includes(t)
          )
        )
      : venueMeta.defaultMarkets;

    for (const market of venueMarkets) {
      const { rate, oi, skew } = getFundingRate(venueId, market, extreme_threshold);
      const history = generateHistory(venueId, market, lookback_hours, extreme_threshold);
      const rateVol = calculateVolatility(history);
      const timeToNext = venueMeta.fundingIntervalHours * 60 -
        (new Date().getMinutes() + venueMeta.fundingIntervalHours * 60 * 0.3) %
        (venueMeta.fundingIntervalHours * 60);

      const isExtreme = Math.abs(rate) >= extreme_threshold;
      const markPrice = 2000 + Math.sin(Date.now() / 10000) * 100;
      const indexPrice = 1900 + Math.sin(Date.now() / 10000) * 50;
      const basis = markPrice - indexPrice;

      const alerts: string[] = [];

      if (isExtreme) {
        const direction = rate > 0 ? "positive" : "negative";
        const annualized = (rate * 365 * 24 * 100).toFixed(2);
        alerts.push(
          `${venueId}/${market}: EXTREME ${direction} funding (${annualized}% annualized)`
        );
        extremeAlerts.push(
          `EXTREME: ${venueId} ${market} — ${(rate * 100).toFixed(4)}%/h (${annualized}% APR), OI: $${(oi / 1e6).toFixed(1)}M, Skew: ${skew.toFixed(2)}`
        );
      }

      if (skew > 1.3) {
        alerts.push(`${venueId}/${market}: Heavily skewed LONG (${skew.toFixed(2)})`);
      } else if (skew < 0.7) {
        alerts.push(`${venueId}/${market}: Heavily skewed SHORT (${skew.toFixed(2)})`);
      }

      if (rateVol > 0.001) {
        alerts.push(`${venueId}/${market}: High funding rate volatility`);
      }

      marketFundings.push({
        venue: venueId,
        market,
        funding_rate: rate,
        funding_rate_8h: Math.round(rate * 8 * 10000) / 10000,
        time_to_next: Math.round(timeToNext),
        open_interest: oi,
        skew,
        mark_price: markPrice,
        index_price: indexPrice,
        basis: Math.round(basis * 100) / 100,
        rate_volatility: rateVol,
        history,
        is_extreme: isExtreme,
        alerts,
      });
    }
  }

  // Find arbitrage opportunities
  const arbitrageOpportunities = findArbitrageOpportunities(marketFundings);

  // Generate summary
  const extremeCount = marketFundings.filter((m) => m.is_extreme).length;
  const avgRate =
    marketFundings.reduce((s, m) => s + m.funding_rate, 0) /
    Math.max(marketFundings.length, 1);
  const summary = `${marketFundings.length} markets across ${venue_ids.length} venues. ${extremeCount} extreme funding rates detected. Average rate: ${(avgRate * 100).toFixed(4)}%/h. ${arbitrageOpportunities.length} arbitrage opportunities found.`;

  return {
    timestamp: new Date().toISOString(),
    markets: marketFundings,
    arbitrage_opportunities: arbitrageOpportunities,
    extreme_rate_alerts: extremeAlerts,
    summary,
  };
}
