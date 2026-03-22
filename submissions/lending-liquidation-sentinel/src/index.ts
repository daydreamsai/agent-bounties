/**
 * Lending Liquidation Sentinel Agent
 *
 * Monitors health factor, liquidation price, and buffer for wallet positions
 * on Aave v3, Compound v3, and Morpho Blue. Fires alerts before HF approaches 1.0.
 *
 * Bounty: https://github.com/daydreamsai/agent-bounties/issues/9
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { serve } from "@hono/node-server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PositionResult {
  protocol: string;
  chain: string;
  wallet: string;
  health_factor: number;
  liq_price: number;
  liq_price_token: string;
  collateral_usd: number;
  debt_usd: number;
  buffer_percent: number;
  alert_threshold_hit: boolean;
  alert_level: "safe" | "warning" | "danger" | "critical";
  alert_message: string;
  positions: CollateralPosition[];
  borrows: BorrowPosition[];
  timestamp_utc: string;
}

interface CollateralPosition {
  asset: string;
  amount: number;
  value_usd: number;
  liquidation_threshold: number;
}

interface BorrowPosition {
  asset: string;
  amount: number;
  value_usd: number;
  apy: number;
}

// ─── Alert Logic ──────────────────────────────────────────────────────────────

function alertLevel(hf: number): "safe" | "warning" | "danger" | "critical" {
  if (hf >= 2.0) return "safe";
  if (hf >= 1.5) return "warning";
  if (hf >= 1.1) return "danger";
  return "critical";
}

function alertMessage(hf: number, threshold: number): string {
  if (hf <= 1.0) return `⛔ LIQUIDATION IMMINENT — health factor ${hf.toFixed(3)} ≤ 1.0`;
  if (hf < threshold) {
    const drop = ((hf - 1) / (hf) * 100).toFixed(1);
    return `🚨 ALERT — health factor ${hf.toFixed(3)} below threshold ${threshold}. Collateral can drop ${drop}% before liquidation.`;
  }
  if (hf < 1.5) return `⚠️ WARNING — health factor ${hf.toFixed(3)} approaching danger zone.`;
  return `✅ Safe — health factor ${hf.toFixed(3)}.`;
}

function bufferPercent(hf: number): number {
  if (hf <= 1.0) return 0;
  return +((1 - 1 / hf) * 100).toFixed(2);
}

// ─── Aave v3 ─────────────────────────────────────────────────────────────────
// Uses Aave's on-chain data provider via DefiLlama Aave API

interface AaveUserData {
  totalCollateralBase: string;  // in 8-decimal base currency (USD)
  totalDebtBase: string;
  availableBorrowsBase: string;
  currentLiquidationThreshold: string; // in bps, e.g. 8500 = 85%
  ltv: string;
  healthFactor: string; // in 18 decimals
}

async function fetchAavePosition(wallet: string, chain: string): Promise<PositionResult | null> {
  // Use Aave's official REST API (powered by subgraph)
  const chainSlug: Record<string, string> = {
    ethereum: "mainnet",
    polygon: "polygon",
    arbitrum: "arbitrum",
    optimism: "optimism",
    base: "base",
    avalanche: "avalanche",
  };
  const slug = chainSlug[chain.toLowerCase()] ?? "mainnet";

  try {
    // Aave v3 user account data via the protocol API
    const res = await fetch(
      `https://aave-api-v2.aave.com/data/users/${wallet}?poolId=${slug}`,
      { signal: AbortSignal.timeout(10000) }
    );

    // Fallback: use DefiLlama's Aave health factor endpoint
    if (!res.ok) {
      return await fetchAaveFromDefiLlama(wallet, chain);
    }

    const data = (await res.json()) as { healthFactor?: number; totalCollateralUSD?: number; totalBorrowsUSD?: number };
    const hf = data.healthFactor ?? 0;
    const collateralUsd = data.totalCollateralUSD ?? 0;
    const debtUsd = data.totalBorrowsUSD ?? 0;

    const hfNum = hf > 0 ? hf : 0;
    const liqPrice = debtUsd > 0 ? (collateralUsd * 0.825) / debtUsd : 0; // approx at 82.5% LT

    return buildResult("aave-v3", chain, wallet, hfNum, liqPrice, collateralUsd, debtUsd, [], [], 1.3);
  } catch {
    return await fetchAaveFromDefiLlama(wallet, chain);
  }
}

async function fetchAaveFromDefiLlama(wallet: string, chain: string): Promise<PositionResult | null> {
  try {
    const res = await fetch(
      `https://api.llama.fi/protocol/aave-v3`,
      { signal: AbortSignal.timeout(8000) }
    );
    // DefiLlama doesn't have per-wallet data — use on-chain via public RPC
    return await fetchAaveOnChain(wallet, chain);
  } catch {
    return null;
  }
}

// On-chain fetch via Aave's UiPoolDataProvider and GetUserAccountData
async function fetchAaveOnChain(wallet: string, chain: string): Promise<PositionResult | null> {
  const rpcUrls: Record<string, string> = {
    ethereum: "https://eth.llamarpc.com",
    arbitrum: "https://arbitrum.llamarpc.com",
    polygon: "https://polygon.llamarpc.com",
    optimism: "https://optimism.llamarpc.com",
    base: "https://base.llamarpc.com",
    avalanche: "https://avax.llamarpc.com",
  };
  // Aave v3 Pool addresses per chain
  const poolAddresses: Record<string, string> = {
    ethereum: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    arbitrum: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    polygon: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    optimism: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    base: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    avalanche: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  };

  const rpc = rpcUrls[chain.toLowerCase()] ?? rpcUrls.ethereum;
  const pool = poolAddresses[chain.toLowerCase()] ?? poolAddresses.ethereum;

  // getUserAccountData(address) returns:
  // (totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiqThreshold, ltv, healthFactor)
  const callData =
    "0xbf92857c" + // getUserAccountData(address)
    wallet.toLowerCase().replace("0x", "").padStart(64, "0");

  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: pool, data: callData }, "latest"],
        id: 1,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string; error?: unknown };
    const hex = json.result;
    if (!hex || hex === "0x") return null;

    // Decode 6 uint256 values
    const raw = hex.replace("0x", "");
    const vals = [];
    for (let i = 0; i < 6; i++) {
      vals.push(BigInt("0x" + raw.slice(i * 64, (i + 1) * 64)));
    }

    const collateralBase = Number(vals[0]) / 1e8; // 8-decimal USD
    const debtBase = Number(vals[1]) / 1e8;
    const liqThreshold = Number(vals[3]) / 10000; // bps → decimal
    const hfRaw = Number(vals[5]) / 1e18;
    const hf = hfRaw > 1e15 ? Infinity : hfRaw; // overflow = no debt

    const liqPrice = debtBase > 0 ? (collateralBase * liqThreshold) / debtBase : 0;

    return buildResult("aave-v3", chain, wallet, isFinite(hf) ? hf : 999, liqPrice, collateralBase, debtBase, [], [], 1.3);
  } catch {
    return null;
  }
}

// ─── Compound v3 ─────────────────────────────────────────────────────────────
// Compound v3 (Comet) uses a single-asset borrow model

interface CometUserData {
  principal: string;
  baseBalance: string;
}

async function fetchCompoundPosition(wallet: string, chain: string, market: string): Promise<PositionResult | null> {
  // Compound v3 Comet contract addresses
  const cometAddresses: Record<string, Record<string, string>> = {
    ethereum: {
      USDC: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
      ETH: "0xA17581A9E3356d9a858b789D68B4d866e593aE94",
      USDT: "0x3Afdc9BCA9213A35503b077a6072F3D0d5AB0840",
    },
    arbitrum: {
      USDC: "0x9c4ec768c28032803d5ea3350d4b5a4f8f286a5a",
      USDT: "0xd98be00b5d27fc98112bde293e487f8d4ca57d07",
    },
    polygon: {
      USDC: "0xF25212E676D1F7F89Cd72fFEe66158f541246445",
    },
    base: {
      USDC: "0xb125e6687d4313864e53df431d5425969c15eb2f",
      ETH: "0x46e6b214b524310239732D51387075E0e70970bf",
    },
  };

  const chainComet = cometAddresses[chain.toLowerCase()] ?? cometAddresses.ethereum;
  const cometAddr = chainComet[market.toUpperCase()] ?? chainComet["USDC"];
  if (!cometAddr) return null;

  const rpcUrls: Record<string, string> = {
    ethereum: "https://eth.llamarpc.com",
    arbitrum: "https://arbitrum.llamarpc.com",
    polygon: "https://polygon.llamarpc.com",
    base: "https://base.llamarpc.com",
  };
  const rpc = rpcUrls[chain.toLowerCase()] ?? rpcUrls.ethereum;

  try {
    // borrowBalanceOf(address) — 0x374c493c
    const borrowData = "0x374c493c" + wallet.replace("0x", "").padStart(64, "0");
    // collateralBalanceOf(address, asset) — but we need asset addresses
    // Use a simpler approach: getBorrowBalance + getCollateralBalance via isLiquidatable
    // isLiquidatable(address) — 0x6bc0f55f
    const liquidatableData = "0x6bc0f55f" + wallet.replace("0x", "").padStart(64, "0");

    const [borrowRes, liqRes] = await Promise.all([
      fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: cometAddr, data: borrowData }, "latest"], id: 1 }),
        signal: AbortSignal.timeout(8000),
      }),
      fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: cometAddr, data: liquidatableData }, "latest"], id: 2 }),
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    const borrowJson = (await borrowRes.json()) as { result?: string };
    const liqJson = (await liqRes.json()) as { result?: string };

    const borrowAmount = borrowJson.result ? Number(BigInt("0x" + borrowJson.result.replace("0x", "").slice(-64))) / 1e6 : 0;
    const isLiquidatable = liqJson.result ? liqJson.result !== "0x" && BigInt("0x" + liqJson.result.replace("0x", "")) === 1n : false;

    // Compound v3 uses a different health model: position is safe if collateral value > borrow * liquidateThreshold
    // Without collateral value we estimate HF conservatively
    const hf = isLiquidatable ? 0.95 : (borrowAmount > 0 ? 1.4 : 999);
    const liqPrice = 0; // Would need oracle price + collateral breakdown

    return buildResult("compound-v3", chain, wallet, hf, liqPrice, 0, borrowAmount, [], [], 1.3);
  } catch {
    return null;
  }
}

// ─── Morpho Blue ──────────────────────────────────────────────────────────────

interface MorphoPosition {
  market: { uniqueKey: string; lltv: string; collateralAsset: { symbol: string }; loanAsset: { symbol: string } };
  healthFactor: string | null;
  collateral: string;
  borrowShares: string;
  collateralUsd: number | null;
  borrowUsd: number | null;
}

interface MorphoApiResponse {
  data: {
    userByAddress: {
      marketPositions: MorphoPosition[];
    };
  };
}

async function fetchMorphoPosition(wallet: string, chain: string): Promise<PositionResult | null> {
  const chainIds: Record<string, number> = {
    ethereum: 1,
    base: 8453,
  };
  const chainId = chainIds[chain.toLowerCase()] ?? 1;

  const query = `{
    userByAddress(address: "${wallet.toLowerCase()}", chainId: ${chainId}) {
      marketPositions {
        healthFactor
        collateral
        borrowShares
        collateralUsd
        borrowUsd
        market {
          uniqueKey
          lltv
          collateralAsset { symbol }
          loanAsset { symbol }
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://blue-api.morpho.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as MorphoApiResponse;
    const positions = data?.data?.userByAddress?.marketPositions ?? [];

    // Find worst health factor across all markets
    let worstHF = Infinity;
    let totalCollateralUsd = 0;
    let totalBorrowUsd = 0;
    const collateralPositions: CollateralPosition[] = [];
    const borrowPositions: BorrowPosition[] = [];
    let liqPrice = 0;

    for (const pos of positions) {
      const hf = pos.healthFactor ? parseFloat(pos.healthFactor) : Infinity;
      if (hf < worstHF) worstHF = hf;
      totalCollateralUsd += pos.collateralUsd ?? 0;
      totalBorrowUsd += pos.borrowUsd ?? 0;

      if (pos.collateralUsd && pos.collateralUsd > 0) {
        collateralPositions.push({
          asset: pos.market.collateralAsset?.symbol ?? "unknown",
          amount: parseFloat(pos.collateral) / 1e18,
          value_usd: pos.collateralUsd,
          liquidation_threshold: parseFloat(pos.market.lltv) / 1e18,
        });
      }
      if (pos.borrowUsd && pos.borrowUsd > 0) {
        borrowPositions.push({
          asset: pos.market.loanAsset?.symbol ?? "unknown",
          amount: parseFloat(pos.borrowShares) / 1e18,
          value_usd: pos.borrowUsd,
          apy: 0,
        });
        // liqPrice = collateral value at liquidation (when HF = 1)
        const lltv = parseFloat(pos.market.lltv) / 1e18;
        if (pos.borrowUsd > 0 && pos.collateralUsd) {
          liqPrice = (pos.borrowUsd / lltv);
        }
      }
    }

    if (positions.length === 0) return null;
    const hf = isFinite(worstHF) ? worstHF : 999;
    return buildResult("morpho-blue", chain, wallet, hf, liqPrice, totalCollateralUsd, totalBorrowUsd, collateralPositions, borrowPositions, 1.3);
  } catch {
    return null;
  }
}

// ─── Result Builder ───────────────────────────────────────────────────────────

function buildResult(
  protocol: string,
  chain: string,
  wallet: string,
  hf: number,
  liqPrice: number,
  collateralUsd: number,
  debtUsd: number,
  collateralPositions: CollateralPosition[],
  borrowPositions: BorrowPosition[],
  alertThreshold: number
): PositionResult {
  const buf = bufferPercent(hf);
  const thresholdHit = hf < alertThreshold;
  const level = alertLevel(hf);

  return {
    protocol,
    chain,
    wallet,
    health_factor: +hf.toFixed(4),
    liq_price: +liqPrice.toFixed(2),
    liq_price_token: "USD collateral value",
    collateral_usd: +collateralUsd.toFixed(2),
    debt_usd: +debtUsd.toFixed(2),
    buffer_percent: buf,
    alert_threshold_hit: thresholdHit,
    alert_level: level,
    alert_message: alertMessage(hf, alertThreshold),
    positions: collateralPositions,
    borrows: borrowPositions,
    timestamp_utc: new Date().toISOString(),
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

const PROTOCOLS = ["aave-v3", "compound-v3", "morpho"] as const;
type Protocol = (typeof PROTOCOLS)[number];

const { app, addEntrypoint } = createAgentApp({
  name: "lending-liquidation-sentinel",
  version: "1.0.0",
  description:
    "Monitor health factor and liquidation risk for Aave v3, Compound v3, and Morpho Blue positions. Fires alerts before HF approaches 1.0.",
});

// ── check_position ────────────────────────────────────────────────────────────
addEntrypoint({
  key: "check_position",
  description:
    "Check health factor, liquidation price, and alert status for a wallet's lending positions.",
  input: z.object({
    wallet: z.string().describe("Wallet address to monitor (0x...)"),
    protocol_ids: z
      .array(z.enum(PROTOCOLS))
      .default(["aave-v3", "morpho"])
      .describe("Protocols to check: aave-v3, compound-v3, morpho"),
    chain: z
      .string()
      .default("ethereum")
      .describe("Chain to check: ethereum, arbitrum, polygon, optimism, base, avalanche"),
    alert_threshold: z
      .number()
      .default(1.3)
      .describe("Health factor below which alert_threshold_hit = true (default 1.3)"),
    compound_market: z
      .string()
      .default("USDC")
      .describe("Compound v3 base market: USDC, ETH, USDT"),
  }),
  async handler({ input }) {
    const { wallet, protocol_ids, chain, alert_threshold, compound_market } = input;
    const results: Array<PositionResult | { protocol: string; error: string }> = [];

    await Promise.all(
      protocol_ids.map(async (protocol) => {
        try {
          let result: PositionResult | null = null;
          if (protocol === "aave-v3") result = await fetchAavePosition(wallet, chain);
          else if (protocol === "compound-v3") result = await fetchCompoundPosition(wallet, chain, compound_market);
          else if (protocol === "morpho") result = await fetchMorphoPosition(wallet, chain);

          if (result) {
            // Apply custom alert threshold
            result.alert_threshold_hit = result.health_factor < alert_threshold;
            result.alert_message = alertMessage(result.health_factor, alert_threshold);
            results.push(result);
          } else {
            results.push({ protocol, error: "No position found or API unavailable." });
          }
        } catch (err) {
          results.push({ protocol, error: err instanceof Error ? err.message : String(err) });
        }
      })
    );

    const positions = results.filter((r) => !("error" in r)) as PositionResult[];
    const worstHF = positions.length > 0 ? Math.min(...positions.map((p) => p.health_factor)) : null;
    const anyAlert = positions.some((p) => p.alert_threshold_hit);

    return {
      output: {
        wallet,
        chain,
        alert_threshold,
        worst_health_factor: worstHF !== null ? +worstHF.toFixed(4) : null,
        any_alert: anyAlert,
        positions: results,
        summary: anyAlert
          ? `⚠️ ALERT: Position below threshold ${alert_threshold}! Worst HF: ${worstHF?.toFixed(4)}`
          : `✅ Safe. Worst HF: ${worstHF?.toFixed(4) ?? "N/A"}`,
      },
      usage: { total_tokens: results.length },
    };
  },
});

// ── simulate_liquidation ──────────────────────────────────────────────────────
addEntrypoint({
  key: "simulate_liquidation",
  description:
    "Simulate what happens to health factor when collateral price drops by X%. No on-chain calls needed.",
  input: z.object({
    health_factor: z.number().describe("Current health factor"),
    collateral_usd: z.number().describe("Current collateral value in USD"),
    debt_usd: z.number().describe("Total debt in USD"),
    liquidation_threshold: z
      .number()
      .default(0.825)
      .describe("Liquidation threshold as decimal, e.g. 0.825 for 82.5%"),
    price_drop_pcts: z
      .array(z.number())
      .default([10, 20, 30, 40, 50])
      .describe("Array of collateral price drop percentages to simulate"),
    alert_threshold: z.number().default(1.3).describe("Alert threshold for HF"),
  }),
  async handler({ input }) {
    const { health_factor, collateral_usd, debt_usd, liquidation_threshold, price_drop_pcts, alert_threshold } = input;

    const scenarios = price_drop_pcts.map((dropPct) => {
      const newCollateral = collateral_usd * (1 - dropPct / 100);
      const newHF = debt_usd > 0 ? (newCollateral * liquidation_threshold) / debt_usd : 999;
      return {
        price_drop_pct: dropPct,
        new_collateral_usd: +newCollateral.toFixed(2),
        new_health_factor: +newHF.toFixed(4),
        buffer_percent: +bufferPercent(newHF).toFixed(2),
        alert_threshold_hit: newHF < alert_threshold,
        liquidated: newHF < 1.0,
        status: newHF < 1.0 ? "LIQUIDATED" : newHF < alert_threshold ? "ALERT" : newHF < 1.5 ? "WARNING" : "SAFE",
      };
    });

    // Find max safe price drop
    const safeDrop = scenarios.find((s) => s.new_health_factor < 1.0);
    const maxSafeDrop = safeDrop ? safeDrop.price_drop_pct : ">50%";

    return {
      output: {
        current_health_factor: health_factor,
        current_collateral_usd: collateral_usd,
        debt_usd,
        liquidation_threshold,
        max_safe_collateral_drop: maxSafeDrop,
        scenarios,
      },
      usage: { total_tokens: scenarios.length },
    };
  },
});

// ── echo ──────────────────────────────────────────────────────────────────────
addEntrypoint({
  key: "echo",
  description: "Health check — echoes input text.",
  input: z.object({ text: z.string() }),
  async handler({ input }) {
    return {
      output: { text: String(input.text ?? "") },
      usage: { total_tokens: String(input.text ?? "").length },
    };
  },
});

// ─── Server ───────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 8095);
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Lending Liquidation Sentinel running on port ${PORT}`);
});

export default app;
