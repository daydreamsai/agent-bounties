import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { getAaveV3Position, getMultiChainPositions } from "./aave.js";
import type { Address } from "viem";

const SUPPORTED_CHAINS = [1, 8453, 42161]; // Ethereum, Base, Arbitrum

const { app, addEntrypoint } = createAgentApp({
  name: "lending-liquidation-sentinel",
  version: "1.0.0",
  description:
    "Monitor Aave V3 borrow positions across Ethereum, Base, and Arbitrum. Fires alerts before health factor crosses 1.0 with accurate liquidation price calculations.",
});

// Main entrypoint: monitor a wallet's lending positions
addEntrypoint({
  key: "monitor",
  description:
    "Monitor health factor and trigger alerts near liquidation for Aave V3 positions",
  input: z.object({
    wallet: z.string().describe("Wallet address to monitor"),
    protocol_ids: z
      .array(z.string())
      .optional()
      .default(["aave_v3"])
      .describe("Lending protocols to check (currently supports aave_v3)"),
    chain_ids: z
      .array(z.number())
      .optional()
      .default(SUPPORTED_CHAINS)
      .describe("Chain IDs to check (1=Ethereum, 8453=Base, 42161=Arbitrum)"),
    alert_threshold: z
      .number()
      .optional()
      .default(1.2)
      .describe("Health factor threshold to trigger alert (default 1.2)"),
  }),
  output: z.object({
    wallet: z.string(),
    positions: z.array(
      z.object({
        chain_id: z.number(),
        chain_name: z.string(),
        health_factor: z.number(),
        liq_price_drop_percent: z.number(),
        buffer_percent: z.number(),
        alert_threshold_hit: z.boolean(),
        total_collateral_usd: z.number(),
        total_debt_usd: z.number(),
        liquidation_threshold: z.number(),
      })
    ),
    overall_health_factor: z.number(),
    overall_alert: z.boolean(),
    risk_level: z.enum(["safe", "warning", "critical", "liquidatable"]),
    summary: z.string(),
  }),
  async handler({ input }) {
    const wallet = input.wallet as Address;
    const chainIds = (input.chain_ids ?? SUPPORTED_CHAINS) as number[];
    const alertThreshold = (input.alert_threshold ?? 1.2) as number;

    const positions = await getMultiChainPositions(wallet, chainIds, alertThreshold);

    // Filter to positions that actually have debt
    const activePositions = positions.filter((p) => p.total_debt_usd > 0);

    // Overall health factor = minimum across chains
    const overallHF =
      activePositions.length > 0
        ? Math.min(...activePositions.map((p) => p.health_factor))
        : 999;

    const overallAlert = activePositions.some((p) => p.alert_threshold_hit);

    let riskLevel: "safe" | "warning" | "critical" | "liquidatable";
    if (overallHF <= 1.0) riskLevel = "liquidatable";
    else if (overallHF < 1.05) riskLevel = "critical";
    else if (overallHF < 1.2) riskLevel = "warning";
    else riskLevel = "safe";

    const totalCollateral = positions.reduce((s, p) => s + p.total_collateral_usd, 0);
    const totalDebt = positions.reduce((s, p) => s + p.total_debt_usd, 0);

    let summary: string;
    if (activePositions.length === 0) {
      summary = `No active borrow positions found for ${wallet} across ${chainIds.length} chains.`;
    } else {
      summary = `Monitoring ${activePositions.length} active position(s) across ${chainIds.length} chains. ` +
        `Total collateral: $${totalCollateral.toFixed(2)}, Total debt: $${totalDebt.toFixed(2)}. ` +
        `Lowest health factor: ${overallHF.toFixed(4)} (${riskLevel}). ` +
        (overallAlert ? `⚠️ ALERT: Health factor below ${alertThreshold} threshold!` : `Health factor above ${alertThreshold} threshold.`);
    }

    return {
      output: {
        wallet,
        positions: positions.map((p) => ({
          chain_id: p.chain_id,
          chain_name: p.chain_name,
          health_factor: p.health_factor,
          liq_price_drop_percent: p.liq_price_drop_percent,
          buffer_percent: p.buffer_percent,
          alert_threshold_hit: p.alert_threshold_hit,
          total_collateral_usd: p.total_collateral_usd,
          total_debt_usd: p.total_debt_usd,
          liquidation_threshold: p.liquidation_threshold,
        })),
        overall_health_factor: overallHF,
        overall_alert: overallAlert,
        risk_level: riskLevel,
        summary,
      },
      usage: { total_tokens: 1 },
    };
  },
});

// Health check entrypoint
addEntrypoint({
  key: "health",
  description: "Health check endpoint",
  input: z.object({}),
  async handler() {
    return {
      output: {
        status: "ok",
        supported_protocols: ["aave_v3"],
        supported_chains: SUPPORTED_CHAINS.map((id) => ({
          id,
          name: id === 1 ? "ethereum" : id === 8453 ? "base" : "arbitrum",
        })),
        version: "1.0.0",
      },
      usage: { total_tokens: 0 },
    };
  },
});

export default app;
