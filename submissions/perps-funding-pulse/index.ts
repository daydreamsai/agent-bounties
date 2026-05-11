import { z } from "zod/v4";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp(
  {
    name: "perps-funding-pulse",
    version: "0.1.0",
    description:
      "Fetch current funding rate, next tick, and open interest per market for perpetuals exchanges",
  },
  {
    config: {
      payments: false,
    },
  }
);

// --- Data sources ---

interface FundingData {
  funding_rate: number;
  time_to_next: string;
  open_interest: number;
  skew: number;
  market: string;
  venue: string;
}

async function fetchBinanceFunding(symbol: string): Promise<FundingData | null> {
  try {
    const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      funding_rate: parseFloat(data.lastFundingRate || "0"),
      time_to_next: new Date(parseInt(data.nextFundingTime)).toISOString(),
      open_interest: 0, // Binance premiumIndex doesn't include OI; fetch separately if needed
      skew: 0, // Not directly provided
      market: symbol.replace("USDT", "/USDT"),
      venue: "binance",
    };
  } catch {
    return null;
  }
}

async function fetchBinanceOI(symbol: string): Promise<number> {
  try {
    const url = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data = await res.json();
    return parseFloat(data.openInterest || "0");
  } catch {
    return 0;
  }
}

async function fetchHyperliquidFunding(coin: string): Promise<FundingData | null> {
  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    });
    if (!res.ok) return null;
    const [meta, assetCtxs] = await res.json();
    const coinIndex = meta.universe.findIndex(
      (c: { name: string }) => c.name === coin
    );
    if (coinIndex === -1) return null;
    const ctx = assetCtxs[coinIndex];
    return {
      funding_rate: parseFloat(ctx.funding || "0"),
      time_to_next: ctx.nextFundingTime
        ? new Date(parseInt(ctx.nextFundingTime)).toISOString()
        : "unknown",
      open_interest: parseFloat(ctx.openInterest || "0"),
      skew: parseFloat(ctx.dayQtyFunding || "0"),
      market: `${coin}/USD`,
      venue: "hyperliquid",
    };
  } catch {
    return null;
  }
}

// Symbol mapping: common symbols across exchanges
function normalizeSymbol(input: string): { binance: string; hyperliquid: string } {
  const s = input.toUpperCase().replace("-", "").replace("/", "").replace(" ", "");
  return {
    binance: s.endsWith("USDT") ? s : s + "USDT",
    hyperliquid: s.replace("USDT", "").replace("USD", ""),
  };
}

// --- Entrypoints ---

// Main entrypoint: fetch funding data for specified venues and markets
addEntrypoint({
  key: "funding",
  description:
    "Fetch current funding rate, next tick, open interest, and skew for perps markets",
  input: z.object({
    venue_ids: z
      .array(z.string())
      .optional()
      .describe("Perpetuals exchanges to query (e.g. binance, hyperliquid)"),
    markets: z
      .array(z.string())
      .optional()
      .describe("Specific markets to track (e.g. BTC, ETH, SOL)"),
  }),
  async handler({ input }) {
    const venues = input.venue_ids ?? ["binance", "hyperliquid"];
    const markets = input.markets ?? ["BTC", "ETH", "SOL"];
    const results: FundingData[] = [];

    for (const market of markets) {
      const symbols = normalizeSymbol(market);

      if (venues.includes("binance")) {
        const [funding, oi] = await Promise.all([
          fetchBinanceFunding(symbols.binance),
          fetchBinanceOI(symbols.binance),
        ]);
        if (funding) {
          funding.open_interest = oi;
          results.push(funding);
        }
      }

      if (venues.includes("hyperliquid")) {
        const hlData = await fetchHyperliquidFunding(symbols.hyperliquid);
        if (hlData) results.push(hlData);
      }
    }

    return {
      output: {
        results,
        count: results.length,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: JSON.stringify(results).length },
    };
  },
});

// Quick entrypoint: single market funding rate
addEntrypoint({
  key: "quick",
  description: "Quick funding rate lookup for a single market",
  input: z.object({
    market: z.string().describe("Market symbol (e.g. BTC, ETH)"),
    venue: z
      .string()
      .optional()
      .describe("Exchange to query (default: binance)"),
  }),
  async handler({ input }) {
    const venue = input.venue ?? "binance";
    const symbols = normalizeSymbol(input.market);
    let result: FundingData | null = null;

    if (venue === "binance") {
      const [funding, oi] = await Promise.all([
        fetchBinanceFunding(symbols.binance),
        fetchBinanceOI(symbols.binance),
      ]);
      if (funding) {
        funding.open_interest = oi;
        result = funding;
      }
    } else if (venue === "hyperliquid") {
      result = await fetchHyperliquidFunding(symbols.hyperliquid);
    }

    if (!result) {
      return {
        output: { error: `No data found for ${input.market} on ${venue}` },
        usage: { total_tokens: 0 },
      };
    }

    return {
      output: result,
      usage: { total_tokens: JSON.stringify(result).length },
    };
  },
});

export default app;