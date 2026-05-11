import { z } from "zod/v4";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp(
  {
    name: "cross-dex-arbitrage-alert",
    version: "0.1.0",
    description:
      "Detect cross-DEX price spreads and arbitrage opportunities for token pairs using DexScreener and DeFiLlama",
  },
  {
    config: {
      payments: {
        facilitatorUrl: process.env.FACILITATOR_URL || "",
        payTo: process.env.ADDRESS || "66dG5r5TD37ahhrsAMKUroxML9Cqto5jRduifiMgQQ3G",
      } as any,
    },
  }
);

// --- Data sources ---

interface PriceQuote {
  pair: string;
  dex: string;
  chain: string;
  price_usd: number;
  volume_24h_usd: number;
  tvl_usd: number;
  source: string;
}

interface ArbOpportunity {
  token: string;
  buy_dex: string;
  buy_chain: string;
  buy_price_usd: number;
  sell_dex: string;
  sell_chain: string;
  sell_price_usd: number;
  spread_pct: number;
  volume_24h_usd: number;
  tvl_usd: number;
}

/** Fetch pair prices from DexScreener for a given token query */
async function fetchDexScreenerPrices(query: string): Promise<PriceQuote[]> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.pairs || []).map((pair: any) => ({
      pair: `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`,
      dex: pair.dexId || "",
      chain: pair.chainId || "",
      price_usd: parseFloat(pair.priceUsd || "0"),
      volume_24h_usd: parseFloat(pair.volume?.h24 || "0"),
      tvl_usd: parseFloat(pair.liquidity?.usd || "0"),
      source: "dexscreener",
    }));
  } catch {
    return [];
  }
}

/** Fetch DEX prices from DeFiLlama for a given token */
async function fetchDeFiLlamaPrices(tokenAddress: string): Promise<PriceQuote[]> {
  try {
    const url = `https://coins.llama.fi/stablecoin/${tokenAddress}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json();
    const coins = json.coins || [];
    return coins.map((coin: any) => ({
      pair: coin.symbol || "",
      dex: coin.dex || "defillama",
      chain: coin.chain || "",
      price_usd: parseFloat(coin.price || "0"),
      volume_24h_usd: parseFloat(coin.volume_24h || "0"),
      tvl_usd: parseFloat(coin.liquidity || "0"),
      source: "defillama",
    }));
  } catch {
    return [];
  }
}

/** Fetch token list from DeFiLlama to get chain/dex info */
async function fetchDeFiLlamaDEXes(): Promise<{ name: string; chain: string; tvl_usd: number }[]> {
  try {
    const url = "https://api.llama.fi/overview/dexs";
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json();
    const protocols = json.protocols || [];
    return protocols.slice(0, 30).map((p: any) => ({
      name: p.name || "",
      chain: p.chain || "",
      tvl_usd: parseFloat(p.tvl || "0"),
    }));
  } catch {
    return [];
  }
}

/** Detect arbitrage opportunities from a list of price quotes */
function detectArbitrage(prices: PriceQuote[], minSpreadPct: number): ArbOpportunity[] {
  // Group by token pair name
  const groups = new Map<string, PriceQuote[]>();
  for (const p of prices) {
    if (!p.price_usd || p.price_usd <= 0) continue;
    const key = p.pair;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const opportunities: ArbOpportunity[] = [];
  for (const [token, quotes] of groups) {
    if (quotes.length < 2) continue;
    // Sort by price ascending
    quotes.sort((a, b) => a.price_usd - b.price_usd);
    const lowest = quotes[0];
    const highest = quotes[quotes.length - 1];
    const spreadPct =
      lowest.price_usd > 0
        ? ((highest.price_usd - lowest.price_usd) / lowest.price_usd) * 100
        : 0;
    if (spreadPct >= minSpreadPct) {
      opportunities.push({
        token,
        buy_dex: lowest.dex,
        buy_chain: lowest.chain,
        buy_price_usd: lowest.price_usd,
        sell_dex: highest.dex,
        sell_chain: highest.chain,
        sell_price_usd: highest.price_usd,
        spread_pct: Math.round(spreadPct * 100) / 100,
        volume_24h_usd: highest.volume_24h_usd,
        tvl_usd: highest.tvl_usd,
      });
    }
  }

  // Sort by spread descending
  opportunities.sort((a, b) => b.spread_pct - a.spread_pct);
  return opportunities;
}

// --- Entrypoints ---

addEntrypoint({
  key: "arb",
  description:
    "Detect cross-DEX arbitrage opportunities for specified tokens by comparing prices across exchanges",
  input: z.object({
    tokens: z
      .array(z.string())
      .optional()
      .describe("Token symbols or addresses to scan (e.g. BTC, ETH, SOL, USDC)"),
    min_spread_pct: z
      .number()
      .optional()
      .describe("Minimum spread percentage to report (default 0.1%)"),
  }),
  async handler({ input }) {
    const tokens = input.tokens ?? ["BTC", "ETH", "SOL", "USDC"];
    const minSpread = input.min_spread_pct ?? 0.1;
    const allPrices: PriceQuote[] = [];

    // Fetch prices from DexScreener for each token
    const dexPromises = tokens.map((t) => fetchDexScreenerPrices(t));
    const dexResults = await Promise.all(dexPromises);
    for (const results of dexResults) {
      allPrices.push(...results);
    }

    // Also try DeFiLlama for tokens that look like addresses
    for (const token of tokens) {
      if (token.startsWith("0x") || token.length > 30) {
        const llamaPrices = await fetchDeFiLlamaPrices(token);
        allPrices.push(...llamaPrices);
      }
    }

    // Filter out zero-price entries
    const validPrices = allPrices.filter((p) => p.price_usd > 0);

    const opportunities = detectArbitrage(validPrices, minSpread);

    return {
      output: {
        opportunities,
        count: opportunities.length,
        prices_scanned: validPrices.length,
        tokens_scanned: tokens,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: JSON.stringify(opportunities).length },
    };
  },
});

addEntrypoint({
  key: "search",
  description: "Search for a specific token pair across DEXs and check for arbitrage spreads",
  input: z.object({
    query: z.string().describe("Token symbol, name, or pair to search (e.g. WBTC, ETH/USDC)"),
    min_spread_pct: z
      .number()
      .optional()
      .describe("Minimum spread percentage to report (default 0.05%)"),
  }),
  async handler({ input }) {
    const minSpread = input.min_spread_pct ?? 0.05;
    const prices = await fetchDexScreenerPrices(input.query);

    const validPrices = prices.filter((p) => p.price_usd > 0);
    const opportunities = detectArbitrage(validPrices, minSpread);

    return {
      output: {
        query: input.query,
        prices_found: validPrices.length,
        opportunities,
        count: opportunities.length,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: JSON.stringify(opportunities).length },
    };
  },
});

addEntrypoint({
  key: "dexes",
  description: "List top DEXes with TVL data from DeFiLlama to identify liquidity sources",
  input: z.object({
    limit: z
      .number()
      .optional()
      .describe("Number of top DEXes to return (default 20)"),
  }),
  async handler({ input }) {
    const limit = input.limit ?? 20;
    const dexes = await fetchDeFiLlamaDEXes();

    return {
      output: {
        dexes: dexes.slice(0, limit),
        count: Math.min(dexes.length, limit),
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: JSON.stringify(dexes).length },
    };
  },
});

export default app;