import { createAgent, http } from "@lucid-dreams/agent-kit";

interface FundingRate {
  dex: string; symbol: string; fundingRate: number; fundingRateAnnualized: number;
  nextFundingTime: string; openInterest: string; markPrice: number; timestamp: string;
}

async function fetchDriftFunding(): Promise<FundingRate[]> {
  try {
    const r = await fetch("https://data.api.drift.trade/Markets");
    const d = await r.json();
    if (!d?.markets) return [];
    return d.markets.map((m: any) => {
      const fr = Number(m.fundingRate || 0);
      return { dex: "drift", symbol: m.symbol || m.ticker || "UNK",
        fundingRate: Math.round(fr * 1e6) / 1e6,
        fundingRateAnnualized: Math.round(fr * 24 * 365 * 100 * 100) / 100,
        nextFundingTime: new Date(Date.now() + 3600000).toISOString(),
        openInterest: m.openInterest ? `$${Number(m.openInterest).toLocaleString()}` : "N/A",
        markPrice: Number(m.price || m.oraclePrice || 0), timestamp: new Date().toISOString() };
    });
  } catch { return []; }
}

async function fetchJupiterPerpsFunding(): Promise<FundingRate[]> {
  try {
    const r = await fetch("https://perps-api.jup.ag/v1/marketData");
    const d = await r.json();
    if (!Array.isArray(d)) return [];
    return d.slice(0, 20).map((m: any) => {
      const fr = Number(m.fundingRate || m.funding_rate || 0);
      return { dex: "jupiter-perps", symbol: m.symbol || m.pair || m.name || "UNK",
        fundingRate: Math.round(fr * 1e6) / 1e6,
        fundingRateAnnualized: Math.round(fr * 24 * 365 * 100 * 100) / 100,
        nextFundingTime: m.nextFundingTs ? new Date(m.nextFundingTs * 1000).toISOString() : new Date(Date.now() + 3600000).toISOString(),
        openInterest: m.openInterest ? `$${Number(m.openInterest).toLocaleString()}` : "N/A",
        markPrice: Number(m.price || m.markPrice || 0), timestamp: new Date().toISOString() };
    });
  } catch { return []; }
}

const agent = createAgent({
  name: "perps-funding-pulse",
  description: "Fetch funding rates for perpetual DEX markets",
  routes: [
    http.get("/funding", async ({ query }) => {
      const dex = (query as any)?.dex as string | undefined;
      let rates: FundingRate[] = [];
      if (!dex || dex === "drift") rates.push(...(await fetchDriftFunding()));
      if (!dex || dex === "jupiter-perps") rates.push(...(await fetchJupiterPerpsFunding()));
      if (dex) rates = rates.filter(r => r.dex === dex);
      return { status: 200, body: { agent: "perps-funding-pulse", timestamp: new Date().toISOString(),
        count: rates.length, fundingRates: rates.sort((a, b) => b.fundingRateAnnualized - a.fundingRateAnnualized) }};
    }),
    http.get("/health", () => ({ status: 200, body: { status: "ok", agent: "perps-funding-pulse" } })),
  ],
});
export default agent;
