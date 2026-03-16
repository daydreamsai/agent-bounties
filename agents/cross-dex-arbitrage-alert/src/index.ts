import { createAgent, http } from "@lucid-dreams/agent-kit";

interface PriceQuote {
  dex: string; chain: string; token: string; price: number; liquidity: string; timestamp: string;
}
interface ArbitrageOpportunity {
  token: string; buyDex: string; sellDex: string; buyPrice: number; sellPrice: number;
  spreadPercent: number; estimatedProfitUSD: number; chain: string;
}

async function fetchJupiterPrices(tokens: string[]): Promise<PriceQuote[]> {
  try {
    const resp = await fetch(`https://api.jup.ag/price/v2?ids=${tokens.join(",")}&showExtraInfo=true`);
    const data = await resp.json();
    if (!data?.data) return [];
    return Object.entries(data.data).map(([mint, info]: [string, any]) => ({
      dex: "jupiter", chain: "solana", token: mint,
      price: Number(info.price) || 0,
      liquidity: info.extraInfo?.quotedPrice ? `$${Number(info.extraInfo.quotedPrice).toLocaleString()}` : "N/A",
      timestamp: new Date().toISOString(),
    }));
  } catch { return []; }
}

function detectArbitrage(quotes: PriceQuote[]): ArbitrageOpportunity[] {
  const byToken: Record<string, PriceQuote[]> = {};
  for (const q of quotes) { if (!byToken[q.token]) byToken[q.token] = []; byToken[q.token].push(q); }
  const opps: ArbitrageOpportunity[] = [];
  for (const [token, qs] of Object.entries(byToken)) {
    if (qs.length < 2) continue;
    for (let i = 0; i < qs.length; i++) {
      for (let j = i + 1; j < qs.length; j++) {
        const [a, b] = [qs[i], qs[j]];
        if (a.price === 0 || b.price === 0) continue;
        const spread = Math.abs(a.price - b.price) / Math.min(a.price, b.price) * 100;
        if (spread > 0.5) {
          const [buy, sell] = a.price < b.price ? [a, b] : [b, a];
          opps.push({ token, buyDex: buy.dex, sellDex: sell.dex, buyPrice: buy.price, sellPrice: sell.price,
            spreadPercent: Math.round(spread * 100) / 100, estimatedProfitUSD: Math.round((sell.price - buy.price) * 1000) / 1000, chain: buy.chain });
        }
      }
    }
  }
  return opps.sort((a, b) => b.spreadPercent - a.spreadPercent);
}

const TOKENS = ["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"];

const agent = createAgent({
  name: "cross-dex-arbitrage-alert",
  description: "Detect price spreads across DEXs for arbitrage opportunities",
  routes: [
    http.get("/spreads", async ({ query }) => {
      const minSpread = parseFloat(((query as any)?.minSpread) || "0.5");
      const quotes = await fetchJupiterPrices(TOKENS);
      const opps = detectArbitrage(quotes).filter(o => o.spreadPercent >= minSpread);
      return { status: 200, body: { agent: "cross-dex-arbitrage-alert", timestamp: new Date().toISOString(), count: opps.length, opportunities: opps } };
    }),
    http.get("/health", () => ({ status: 200, body: { status: "ok", agent: "cross-dex-arbitrage-alert" } })),
  ],
});
export default agent;
