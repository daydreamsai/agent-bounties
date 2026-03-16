import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import axios from "axios";

const { app, addEntrypoint } = createAgentApp({
  name: "lending-liquidation-sentinel",
  version: "0.1.0",
  description: "Watch borrow positions and warn before liquidation risk.",
});

// Mock function for on-chain lending protocol calls (Aave V3 style)
async function fetchLendingPosition(wallet, protocolId) {
  // In production, we'd use viem to call Aave's PoolDataProvider
  // getConfiguration() and getUserAccountData()
  return {
    totalCollateralBase: 10000n, // $10,000 equivalent
    totalDebtBase: 8000n,        // $8,000 equivalent
    currentLiquidationThreshold: 8500n, // 85%
    healthFactor: 10625n // 1.0625 (represented as 1e4 here for simplicity)
  };
}

addEntrypoint({
  key: "monitor_health",
  description: "Monitor health factor and trigger alerts near liquidation",
  input: z.object({
    wallet: z.string(),
    protocol_ids: z.array(z.string()),
    positions: z.array(z.string()).optional(),
  }),
  async handler({ input }) {
    const ALERT_THRESHOLD_HF = 1.10; // Alert if Health Factor drops below 1.1

    let finalHealthFactor = "Infinity";
    let finalLiqPrice = 0;
    let finalBuffer = 100;
    let alertHit = false;

    for (const protocol of input.protocol_ids) {
      try {
        const data = await fetchLendingPosition(input.wallet, protocol);
        
        // Compute standard Health Factor
        // HF = (Collateral * LiquidationThreshold) / Debt
        const hf = Number(data.healthFactor) / 10000;
        
        if (hf < parseFloat(finalHealthFactor) || finalHealthFactor === "Infinity") {
          finalHealthFactor = hf.toFixed(4);
          
          // Liq Price of Collateral = Debt / (Amount * LiqThreshold)
          // Simplified proxy for the bounty submission
          finalLiqPrice = Number(data.totalDebtBase) / (Number(data.currentLiquidationThreshold) / 10000);
          
          // Buffer percent = (HF - 1) * 100
          finalBuffer = (hf - 1.0) * 100;

          if (hf <= ALERT_THRESHOLD_HF) {
             alertHit = true;
          }
        }
      } catch (e) {
        console.error(`Error checking protocol ${protocol}:`, e);
      }
    }

    return {
      output: {
        health_factor: finalHealthFactor,
        liq_price: finalLiqPrice.toFixed(2),
        buffer_percent: finalBuffer.toFixed(2),
        alert_threshold_hit: alertHit,
      },
      usage: { total_tokens: 150 },
    };
  },
});

export default app;