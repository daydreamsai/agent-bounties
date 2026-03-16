import { createAgent, http } from "@lucid-dreams/agent-kit";

interface PoolInfo {
  pairAddress: string;
  tokenA: string;
  tokenBSymbol: string;
  tokenASymbol: string;
  chain: string;
  dex: string;
  createdAt: string;
  initialLiquidity: string;
}

async function fetchNewPoolsRaydium(): Promise<PoolInfo[]> {
  try {
    const resp = await fetch(
      "https://api-v3.raydium.io/pools/info/list?poolType=all&poolSortField=apr24h&sortType=desc&pageSize=20&page=1"
    );
    const data = await resp.json();
    if (!data?.data?.data) return [];
    return data.data.data.slice(0, 10).map((pool: any) => ({
      pairAddress: pool.id || pool.poolId,
      tokenA: pool.mintA?.symbol || "UNKNOWN",
      tokenBSymbol: pool.mintB?.symbol || "UNKNOWN",
      tokenASymbol: pool.mintA?.symbol || "UNKNOWN",
      chain: "solana",
      dex: "raydium",
      createdAt: pool.openTime ? new Date(pool.openTime * 1000).toISOString() : new Date().toISOString(),
      initialLiquidity: pool.tvl ? `$${Number(pool.tvl).toLocaleString()}` : "N/A",
    }));
  } catch { return []; }
}

async function fetchNewPoolsGecko(chain: string = "solana"): Promise<PoolInfo[]> {
  try {
    const resp = await fetch(`https://api.geckoterminal.com/api/v2/networks/${chain}/new_pools?page=1`);
    const data = await resp.json();
    if (!data?.data) return [];
    return data.data.slice(0, 10).map((pool: any) => ({
      pairAddress: pool.attributes?.address || "unknown",
      tokenA: pool.attributes?.name?.split("/")[0]?.trim() || "UNKNOWN",
      tokenBSymbol: pool.attributes?.name?.split("/")[1]?.trim() || "UNKNOWN",
      tokenASymbol: pool.attributes?.name?.split("/")[0]?.trim() || "UNKNOWN",
      chain,
      dex: pool.relationships?.dex?.data?.id || "unknown",
      createdAt: pool.attributes?.pool_created_at || new Date().toISOString(),
      initialLiquidity: pool.attributes?.reserve_in_usd ? `$${Number(pool.attributes.reserve_in_usd).toLocaleString()}` : "N/A",
    }));
  } catch { return []; }
}

const agent = createAgent({
  name: "fresh-markets-watch",
  description: "Monitor new AMM pairs and pools across DEXs",
  routes: [
    http.get("/pairs/new", async ({ query }) => {
      const chain = (query as any)?.chain as string | undefined;
      const dex = (query as any)?.dex as string | undefined;
      let pools: PoolInfo[] = [];
      if (!dex || dex === "raydium") pools.push(...(await fetchNewPoolsRaydium()));
      if (!dex || dex === "gecko") {
        const chains = chain ? [chain] : ["solana", "ethereum", "base"];
        for (const c of chains) pools.push(...(await fetchNewPoolsGecko(c)));
      }
      if (chain) pools = pools.filter((p) => p.chain === chain);
      return { status: 200, body: { agent: "fresh-markets-watch", timestamp: new Date().toISOString(), count: pools.length, pools } };
    }),
    http.get("/health", () => ({ status: 200, body: { status: "ok", agent: "fresh-markets-watch" } })),
  ],
});

export default agent;
