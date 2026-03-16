import { createAgent, http } from "@lucid-dreams/agent-kit";

function calculateIL(priceRatio: number): number {
  const sqrt = Math.sqrt(priceRatio);
  return (2 * sqrt) / (1 + priceRatio) - 1;
}

function projections() {
  return [
    { priceChange: "-50%", ilPercent: Math.round(calculateIL(0.5) * 10000) / 100 },
    { priceChange: "-25%", ilPercent: Math.round(calculateIL(0.75) * 10000) / 100 },
    { priceChange: "+25%", ilPercent: Math.round(calculateIL(1.25) * 10000) / 100 },
    { priceChange: "+50%", ilPercent: Math.round(calculateIL(1.5) * 10000) / 100 },
    { priceChange: "+100%", ilPercent: Math.round(calculateIL(2.0) * 10000) / 100 },
    { priceChange: "+200%", ilPercent: Math.round(calculateIL(3.0) * 10000) / 100 },
    { priceChange: "+400%", ilPercent: Math.round(calculateIL(5.0) * 10000) / 100 },
  ];
}

async function getTokenPrices(a: string, b: string) {
  try {
    const r = await fetch(`https://api.jup.ag/price/v2?ids=${a},${b}`);
    const d = await r.json();
    const pa = Number(d?.data?.[a]?.price) || 0;
    const pb = Number(d?.data?.[b]?.price) || 0;
    return pa && pb ? { priceA: pa, priceB: pb } : null;
  } catch { return null; }
}

async function getPoolInfo(poolId: string) {
  try {
    const r = await fetch(`https://api-v3.raydium.io/pools/info/ids?ids=${poolId}`);
    const d = await r.json();
    return d?.data?.[0] || null;
  } catch { return null; }
}

const agent = createAgent({
  name: "lp-impermanent-loss-estimator",
  description: "Calculate IL and fee APR for LP positions",
  routes: [
    http.get("/il", async ({ query }) => {
      const q = query as any;
      if (!q?.tokenA || !q?.tokenB || !q?.entryPriceA || !q?.entryPriceB)
        return { status: 400, body: { error: "Missing: tokenA, tokenB, entryPriceA, entryPriceB" } };
      const prices = await getTokenPrices(q.tokenA, q.tokenB);
      if (!prices) return { status: 502, body: { error: "Failed to fetch prices" } };
      const entryRatio = Number(q.entryPriceA) / Number(q.entryPriceB);
      const curRatio = prices.priceA / prices.priceB;
      const il = calculateIL(curRatio / entryRatio);
      return { status: 200, body: { agent: "lp-impermanent-loss-estimator", timestamp: new Date().toISOString(), result: {
        impermanentLossPercent: Math.round(il * 10000) / 100, entryPriceRatio: entryRatio, currentPriceRatio: curRatio,
        priceChangePercent: Math.round(((prices.priceA - Number(q.entryPriceA)) / Number(q.entryPriceA)) * 10000) / 100,
        netPosition: il < -0.01 ? `Down ${Math.abs(Math.round(il * 10000) / 100)}% from IL` : "Minimal IL",
        projections: projections()
      }}};
    }),
    http.get("/il/position", async ({ query }) => {
      const pool = (query as any)?.pool;
      if (!pool) return { status: 400, body: { error: "Missing: pool" } };
      const info = await getPoolInfo(pool);
      if (!info) return { status: 404, body: { error: "Pool not found" } };
      const vol = Number(info.day?.volume) || 0;
      const tvl = Number(info.tvl) || 0;
      const feeAPR = tvl > 0 ? Math.round((vol * 0.003 * 365 / tvl) * 10000) / 100 : 0;
      return { status: 200, body: { agent: "lp-impermanent-loss-estimator", pool: {
        address: pool, tokenA: info.mintA?.symbol, tokenB: info.mintB?.symbol,
        tvl: info.tvl, volume24h: info.day?.volume, feeAPR, apr24h: info.day?.apr
      }, projections: projections() }};
    }),
    http.get("/health", () => ({ status: 200, body: { status: "ok", agent: "lp-impermanent-loss-estimator" } })),
  ],
});
export default agent;
