import { z } from "zod/v4";
import { createAgentApp } from "@lucid-dreams/agent-kit";

const { app, addEntrypoint } = createAgentApp(
  {
    name: "lending-liquidation-sentinel",
    version: "0.1.0",
      description:
      "Watch borrow positions and warn before liquidation risk across DeFi lending protocols",
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

// --- Types ---

interface Position {
  protocol: string;
  chain: string;
  collateral_symbol: string;
  collateral_amount: number;
  collateral_usd: number;
  debt_symbol: string;
  debt_amount: number;
  debt_usd: number;
  health_factor: number;
  liquidation_threshold: number;
  ltv: number;
}

interface LiquidationRisk {
  wallet: string;
  health_factor: number;
  liq_price_pct_drop: number;
  buffer_percent: number;
  alert_threshold_hit: boolean;
  positions: Position[];
}

// --- Data Sources ---
// We use DeFiLlama's API for real lending protocol data

const PROTOCOL_MAP: Record<string, string> = {
  aave: "aave",
  compound: "compound-finance",
  maker: "makerdao",
  spark: "spark",
  morpho: "morpho",
  venus: "venus",
  benqi: "benqi",
  granary: "granary-finance",
};

const CHAIN_MAP: Record<string, string> = {
  ethereum: "Ethereum",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  avalanche: "Avalanche",
  base: "Base",
};

/** Fetch lending positions for a wallet from DeFiLlama's /borrower endpoint */
async function fetchBorrowerPositions(
  wallet: string,
  protocolIds?: string[]
): Promise<Position[]> {
  try {
    const url = `https://debts.llama.fi/borrower/${wallet}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const json = await res.json();

    const positions: Position[] = [];
    const protocols = json.balances || [];

    for (const proto of protocols) {
      const protoName = proto.name?.toLowerCase() || "";
      if (protocolIds && protocolIds.length > 0) {
        const match = protocolIds.some(
          (p) =>
            protoName.includes(p.toLowerCase()) ||
            (PROTOCOL_MAP[p.toLowerCase()] || "").includes(protoName)
        );
        if (!match) continue;
      }

      for (const balance of proto.balances || []) {
        const collateralUsd = parseFloat(balance.collateral || "0");
        const debtUsd = parseFloat(balance.debt || "0");

        if (collateralUsd <= 0 && debtUsd <= 0) continue;

        const liquidationThreshold = parseFloat(
          balance.liquidationThreshold || "0.8"
        );
        const ltv =
          collateralUsd > 0
            ? debtUsd / collateralUsd
            : 0;
        const healthFactor =
          ltv > 0 && liquidationThreshold > 0
            ? liquidationThreshold / ltv
            : ltv === 0
              ? Infinity
              : 0;

        positions.push({
          protocol: proto.name || "unknown",
          chain: balance.chain || "unknown",
          collateral_symbol: balance.symbol || "unknown",
          collateral_amount: parseFloat(balance.amount || "0"),
          collateral_usd: collateralUsd,
          debt_symbol: balance.debtSymbol || "unknown",
          debt_amount: parseFloat(balance.debtAmount || "0"),
          debt_usd: debtUsd,
          health_factor: isFinite(healthFactor)
            ? Math.round(healthFactor * 10000) / 10000
            : 9999,
          liquidation_threshold: liquidationThreshold,
          ltv: Math.round(ltv * 10000) / 10000,
        });
      }
    }

    return positions;
  } catch {
    return [];
  }
}

/** Fetch protocol-level lending data from DeFiLlama */
async function fetchProtocolData(protocolId: string): Promise<{
  totalDepositedUsd: number;
  totalBorrowedUsd: number;
  chains: string[];
} | null> {
  try {
    const slug = PROTOCOL_MAP[protocolId.toLowerCase()] || protocolId;
    const url = `https://api.llama.fi/protocol/${slug}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = await res.json();

    const tvl = parseFloat(json.tvl?.[0]?.totalLiquidityUSD || "0");
    const borrowed = Object.values(json?.chainBorrowAmounts?.current || {}).reduce(
      (sum: number, v: any) => sum + parseFloat(v || "0"),
      0
    );

    const chains = Object.keys(json.chainTvls || {}).filter(
      (c) => !c.includes("-") && !c.includes("_")
    );

    return {
      totalDepositedUsd: tvl,
      totalBorrowedUsd: borrowed,
      chains,
    };
  } catch {
    return null;
  }
}

/** Calculate liquidation risk metrics for positions */
function calculateRisk(
  wallet: string,
  positions: Position[],
  alertThreshold: number
): LiquidationRisk {
  // Find the most at-risk position
  const riskyPositions = positions.filter((p) => p.health_factor < 9999 && p.debt_usd > 0);
  const minHealth = riskyPositions.length > 0
    ? Math.min(...riskyPositions.map((p) => p.health_factor))
    : Infinity;

  const healthFactor = isFinite(minHealth) ? minHealth : 9999;

  // Calculate liquidation price drop percentage
  // A position is liquidated when health_factor drops to 1.0
  // If current HF is 1.5, collateral needs to drop by (1 - 1/1.5) = 33.3%
  const liqPricePctDrop =
    healthFactor > 0 && isFinite(healthFactor)
      ? Math.round((1 - 1 / healthFactor) * 10000) / 100
      : 0;

  // Buffer: percentage above the liquidation threshold
  const bufferPercent = isFinite(healthFactor) && healthFactor > 0
    ? Math.round((healthFactor - 1) * 10000) / 100
    : 100;

  const alertThresholdHit =
    isFinite(healthFactor) && healthFactor <= alertThreshold;

  return {
    wallet,
    health_factor: Math.round(healthFactor * 10000) / 10000,
    liq_price_pct_drop: liqPricePctDrop,
    buffer_percent: bufferPercent,
    alert_threshold_hit: alertThresholdHit,
    positions: riskyPositions.sort((a, b) => a.health_factor - b.health_factor),
  };
}

// --- Entrypoints ---

addEntrypoint({
  key: "monitor",
  description:
    "Monitor a wallet's lending positions and assess liquidation risk across protocols",
  input: z.object({
    wallet: z
      .string()
      .describe("Wallet address to monitor (EVM or Solana)"),
    protocol_ids: z
      .array(z.string())
      .optional()
      .describe("Lending protocols to check (e.g. aave, compound, maker, spark)"),
    alert_threshold: z
      .number()
      .optional()
      .describe("Health factor threshold to trigger alert (default 1.5)"),
  }),
  async handler({ input }) {
    const alertThreshold = input.alert_threshold ?? 1.5;
    const positions = await fetchBorrowerPositions(
      input.wallet,
      input.protocol_ids
    );

    const risk = calculateRisk(input.wallet, positions, alertThreshold);

    return {
      output: {
        wallet: risk.wallet,
        health_factor: risk.health_factor,
        liq_price_pct_drop: risk.liq_price_pct_drop,
        buffer_percent: risk.buffer_percent,
        alert_threshold_hit: risk.alert_threshold_hit,
        positions_count: risk.positions.length,
        positions: risk.positions,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: JSON.stringify(risk).length },
    };
  },
});

addEntrypoint({
  key: "positions",
  description:
    "Get detailed position breakdown for a wallet across lending protocols with collateral and debt info",
  input: z.object({
    wallet: z
      .string()
      .describe("Wallet address to check positions for"),
    protocol_ids: z
      .array(z.string())
      .optional()
      .describe("Filter by specific lending protocols"),
  }),
  async handler({ input }) {
    const positions = await fetchBorrowerPositions(
      input.wallet,
      input.protocol_ids
    );

    const collateralTotal = positions.reduce((s, p) => s + p.collateral_usd, 0);
    const debtTotal = positions.reduce((s, p) => s + p.debt_usd, 0);

    return {
      output: {
        wallet: input.wallet,
        total_collateral_usd: Math.round(collateralTotal * 100) / 100,
        total_debt_usd: Math.round(debtTotal * 100) / 100,
        positions_count: positions.length,
        positions: positions.sort((a, b) => a.health_factor - b.health_factor),
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: JSON.stringify(positions).length },
    };
  },
});

addEntrypoint({
  key: "protocol",
  description: "Get protocol-level lending data including TVL and available chains",
  input: z.object({
    protocol_id: z
      .string()
      .describe("Protocol to query (e.g. aave, compound, maker, spark)"),
  }),
  async handler({ input }) {
    const data = await fetchProtocolData(input.protocol_id);

    if (!data) {
      return {
        output: {
          protocol: input.protocol_id,
          error: "Protocol not found or API unavailable",
          timestamp: new Date().toISOString(),
        },
        usage: { total_tokens: 0 },
      };
    }

    return {
      output: {
        protocol: input.protocol_id,
        total_deposited_usd: data.totalDepositedUsd,
        total_borrowed_usd: data.totalBorrowedUsd,
        chains: data.chains,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: JSON.stringify(data).length },
    };
  },
});

export default app;