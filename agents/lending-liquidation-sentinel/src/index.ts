import type { BorrowPosition, ProtocolId, ChainId, HealthFactorResult, SimulationResult } from "./types.js";
import { computeHealthFactor, simulatePriceDrop, computeMultiplePositions, DEFAULT_ALERT_CONFIG } from "./calculations.js";

export interface SentinelInput {
  wallet: string;
  protocols: ProtocolId[];
  chain?: ChainId;
  positions?: BorrowPosition[];
  simulate?: { crashPercent: number };
}

export interface SentinelOutput {
  wallet: string;
  positions: HealthFactorResult[];
  alerts: string[];
  simulation?: SimulationResult[];
  timestamp: string;
}

export async function checkHealth(input: SentinelInput): Promise<SentinelOutput> {
  const positions = input.positions ?? [];
  const results = computeMultiplePositions(positions);
  
  const alerts: string[] = [];
  for (const r of results) {
    if (r.riskLevel === "critical") {
      alerts.push(`CRITICAL: HF=${r.healthFactor.toFixed(4)} on ${r.position.protocol} — LIQUIDATION IMMINENT`);
    } else if (r.riskLevel === "danger") {
      alerts.push(`DANGER: HF=${r.healthFactor.toFixed(4)} on ${r.position.protocol}`);
    } else if (r.riskLevel === "warning") {
      alerts.push(`WARNING: HF=${r.healthFactor.toFixed(4)} on ${r.position.protocol}`);
    }
  }

  return {
    wallet: input.wallet,
    positions: results,
    alerts,
    timestamp: new Date().toISOString(),
  };
}

export async function simulate(input: SentinelInput): Promise<SentinelOutput> {
  const positions = input.positions ?? [];
  const crashPercent = input.simulate?.crashPercent ?? 20;
  
  const simulations = positions.map(pos => simulatePriceDrop(pos, crashPercent));
  
  const baseOutput = await checkHealth(input);
  return { ...baseOutput, simulation: simulations };
}

// Standalone HTTP server
async function main() {
  const { serve } = await import("@hono/node-server");
  const { Hono } = await import("hono");
  
  const app = new Hono();
  
  app.post("/check_health", async (c) => {
    const input = await c.req.json<SentinelInput>();
    return c.json(await checkHealth(input));
  });
  
  app.post("/simulate", async (c) => {
    const input = await c.req.json<SentinelInput>();
    return c.json(await simulate(input));
  });
  
  const port = Number(process.env.PORT ?? 3456);
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Lending Liquidation Sentinel running on port ${port}`);
  });
}

main().catch(console.error);
