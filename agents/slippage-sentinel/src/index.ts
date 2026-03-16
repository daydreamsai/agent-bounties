import { createAgent, http } from "@lucid-dreams/agent-kit";

interface SlippageRecommendation {
  tokenA: string; tokenB: string; amount: string;
  recommendedSlippage: number; minSlippage: number; maxSlippage: number;
  confidence: "high" | "medium" | "low";
  factors: { poolDepth: string; priceImpact: number; recommendation: string };
}

async function getSwapQuote(inputMint: string, outputMint: string, amount: string, slippageBps: number = 100) {
  try {
    const resp = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`);
    return resp.ok ? await resp.json() : null;
  } catch { return null; }
}

async function getPoolDepth(inputMint: string, outputMint: string): Promise<{ depth: string; score: number }> {
  try {
    const resp = await fetch(`https://api.jup.ag/price/v2?ids=${inputMint},${outputMint}&showExtraInfo=true`);
    const data = await resp.json();
    const liquidity = Object.values(data?.data || {}).reduce((s: number, p: any) => s + (p?.extraInfo?.liquidity || 0), 0);
    if (liquidity > 10_000_000) return { depth: "deep", score: 0.8 };
    if (liquidity > 1_000_000) return { depth: "moderate", score: 0.5 };
    return { depth: "shallow", score: 0.2 };
  } catch { return { depth: "unknown", score: 0.3 }; }
}

function calcSlippage(priceImpact: number, poolScore: number) {
  const base = Math.max(priceImpact * 1.5, 0.3);
  const adj = base * (1 - poolScore * 0.3);
  const conf: "high" | "medium" | "low" = poolScore > 0.7 && priceImpact < 1 ? "high" : poolScore > 0.4 ? "medium" : "low";
  return { recommended: Math.round(Math.min(adj, 50) * 100) / 100, min: Math.round(Math.max(adj * 0.5, 0.1) * 100) / 100, max: Math.round(Math.min(adj * 2, 50) * 100) / 100, confidence: conf };
}

const agent = createAgent({
  name: "slippage-sentinel",
  description: "Estimate safe slippage tolerance for swaps",
  routes: [
    http.get("/slippage", async ({ query }) => {
      const q = query as any;
      if (!q?.tokenA || !q?.tokenB || !q?.amount) return { status: 400, body: { error: "Missing: tokenA, tokenB, amount" } };
      const [quote, pool] = await Promise.all([getSwapQuote(q.tokenA, q.tokenB, q.amount), getPoolDepth(q.tokenA, q.tokenB)]);
      if (!quote) return { status: 502, body: { error: "Failed to fetch quote" } };
      const pi = parseFloat(quote.priceImpactPct) || 0;
      const sl = calcSlippage(pi, pool.score);
      const rec: SlippageRecommendation = { tokenA: q.tokenA, tokenB: q.tokenB, amount: q.amount, ...sl,
        factors: { poolDepth: pool.depth, priceImpact: pi, recommendation: sl.confidence === "high" ? "Safe to use recommended" : sl.confidence === "medium" ? "Consider slightly higher slippage" : "Low liquidity — use higher slippage" } };
      return { status: 200, body: { agent: "slippage-sentinel", timestamp: new Date().toISOString(), recommendation: rec } };
    }),
    http.get("/health", () => ({ status: 200, body: { status: "ok", agent: "slippage-sentinel" } })),
  ],
});
export default agent;
