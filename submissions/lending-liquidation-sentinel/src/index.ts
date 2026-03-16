/**
 * Lending Liquidation Sentinel Agent
 *
 * Monitors borrow positions and warns before liquidation risk on Aave V3.
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/9
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// Aave V3 subgraph endpoints
const AAVE_SUBGRAPHS: Record<string, string> = {
  ethereum: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3",
  polygon: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon",
  arbitrum: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum",
  optimism: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism",
  base: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base",
  avalanche: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-avalanche",
};

// Aave V3 REST API (UiPoolDataProvider)
const AAVE_REST_ENDPOINTS: Record<string, string> = {
  ethereum: "https://api.aave.com/data/users",
  polygon: "https://api.aave.com/data/users",
};

interface UserPosition {
  protocol: string;
  chain: string;
  total_collateral_usd: number;
  total_debt_usd: number;
  health_factor: number;
  liq_threshold: number;
  liq_price_buffer_pct: number;
  alert_threshold_hit: boolean;
  reserves: {
    symbol: string;
    type: "collateral" | "debt";
    amount: number;
    value_usd: number;
    liquidation_threshold?: number;
  }[];
}

async function fetchAaveV3Position(wallet: string, chain: string): Promise<UserPosition | null> {
  const subgraphUrl = AAVE_SUBGRAPHS[chain.toLowerCase()];
  if (!subgraphUrl) return null;

  const query = `
    query GetUserData($user: String!) {
      users(where: { id: $user }) {
        id
        reserves {
          reserve {
            symbol
            decimals
            price { priceInEth }
            liquidationThreshold
            reserveLiquidationThreshold
          }
          currentTotalDebt
          currentATokenBalance
          usageAsCollateralEnabledOnUser
        }
        borrowedReservesCount
      }
    }
  `;

  try {
    const res = await fetch(subgraphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { user: wallet.toLowerCase() } }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.data?.users?.[0];
    if (!user || user.reserves.length === 0) return null;

    // Fallback: calculate approximate health factor
    let totalCollateralUsd = 0;
    let totalDebtUsd = 0;
    let weightedThreshold = 0;
    const reserves = [];

    for (const r of user.reserves) {
      const symbol = r.reserve.symbol;
      const decimals = parseInt(r.reserve.decimals || "18");
      const liqThreshold = parseInt(r.reserve.reserveLiquidationThreshold || "8000") / 10000;

      // Use a rough ETH price approximation for non-USD assets
      const priceUsd = await getTokenPriceUsd(symbol);

      const debtAmt = parseFloat(r.currentTotalDebt || "0") / 10 ** decimals;
      const collAmt = parseFloat(r.currentATokenBalance || "0") / 10 ** decimals;

      const debtUsd = debtAmt * priceUsd;
      const collUsd = collAmt * priceUsd;

      if (collUsd > 0 && r.usageAsCollateralEnabledOnUser) {
        totalCollateralUsd += collUsd;
        weightedThreshold += collUsd * liqThreshold;
        reserves.push({ symbol, type: "collateral" as const, amount: collAmt, value_usd: collUsd, liquidation_threshold: liqThreshold });
      }
      if (debtUsd > 0) {
        totalDebtUsd += debtUsd;
        reserves.push({ symbol, type: "debt" as const, amount: debtAmt, value_usd: debtUsd });
      }
    }

    if (totalCollateralUsd === 0 && totalDebtUsd === 0) return null;

    const avgThreshold = totalCollateralUsd > 0 ? weightedThreshold / totalCollateralUsd : 0.8;
    const healthFactor = totalDebtUsd > 0
      ? (totalCollateralUsd * avgThreshold) / totalDebtUsd
      : 999;

    const bufferPct = totalDebtUsd > 0
      ? ((healthFactor - 1.0) / healthFactor) * 100
      : 100;

    return {
      protocol: "Aave V3",
      chain,
      total_collateral_usd: totalCollateralUsd,
      total_debt_usd: totalDebtUsd,
      health_factor: healthFactor,
      liq_threshold: avgThreshold,
      liq_price_buffer_pct: bufferPct,
      alert_threshold_hit: healthFactor < 1.2,
      reserves,
    };
  } catch {
    return null;
  }
}

// Simple token price lookup via CoinGecko
const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum", WETH: "ethereum", USDC: "usd-coin", USDT: "tether",
  DAI: "dai", WBTC: "wrapped-bitcoin", MATIC: "matic-network",
  LINK: "chainlink", UNI: "uniswap", AAVE: "aave", ARB: "arbitrum",
  OP: "optimism", AVAX: "avalanche-2", BNB: "binancecoin",
};
const priceCache: Record<string, { price: number; ts: number }> = {};

async function getTokenPriceUsd(symbol: string): Promise<number> {
  const id = COINGECKO_IDS[symbol.toUpperCase()];
  if (!id) return 1; // default for stables

  const cached = priceCache[symbol];
  if (cached && Date.now() - cached.ts < 60000) return cached.price;

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    if (!res.ok) return 1;
    const data = await res.json();
    const price = data[id]?.usd || 1;
    priceCache[symbol] = { price, ts: Date.now() };
    return price;
  } catch {
    return 1;
  }
}

// ─── Agent App ────────────────────────────────────────────────────────────────

const { app, addEntrypoint } = createAgentApp({
  name: "lending-liquidation-sentinel",
  version: "1.0.0",
  description: "Monitor borrow positions and warn before liquidation risk on Aave V3.",
});

addEntrypoint({
  key: "check_health",
  description: "Monitor health factor and trigger alerts near liquidation on Aave V3.",
  input: z.object({
    wallet: z.string().describe("Wallet address to monitor"),
    protocol_ids: z.array(z.enum(["aave_v3"])).default(["aave_v3"]).describe("Lending protocols to check"),
    chains: z.array(z.string()).default(["ethereum", "polygon", "arbitrum"]).describe("Chains to check"),
    alert_threshold: z.number().default(1.2).describe("Health factor alert threshold (default 1.2)"),
  }),
  async handler({ input }) {
    const results: UserPosition[] = [];

    for (const chain of input.chains) {
      const pos = await fetchAaveV3Position(input.wallet, chain);
      if (pos) {
        pos.alert_threshold_hit = pos.health_factor < input.alert_threshold;
        results.push(pos);
      }
    }

    const highestRisk = results.length > 0
      ? results.reduce((a, b) => a.health_factor < b.health_factor ? a : b)
      : null;

    const criticalAlerts = results.filter(r => r.alert_threshold_hit);

    return {
      output: {
        wallet: input.wallet,
        positions: results,
        highest_risk: highestRisk,
        total_positions: results.length,
        critical_alerts: criticalAlerts.length,
        alert_threshold_hit: criticalAlerts.length > 0,
        fetched_at: new Date().toISOString(),
      },
      usage: { total_tokens: String(results.length) },
    };
  },
});

addEntrypoint({
  key: "echo",
  description: "Health check",
  input: z.object({ text: z.string().optional() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "lending-liquidation-sentinel online") },
      usage: { total_tokens: "0" },
    };
  },
});

const PORT = parseInt(process.env.PORT ?? "8083");
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Lending Liquidation Sentinel running on http://0.0.0.0:${info.port}`);
});

export default app;
