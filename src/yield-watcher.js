import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import axios from "axios";

// DefiLlama yields API base URL
const DEFILLAMA_YIELDS_API = "https://yields.llama.fi";

// Create the agent app
const { app, addEntrypoint } = createAgentApp({
  name: "yield-pool-watcher",
  version: "0.1.0",
  description: "Track APY and TVL across DeFi pools and alert on sharp changes.",
});

// Helper function to fetch pool data
async function fetchPoolData(poolId) {
  try {
    const res = await axios.get(`${DEFILLAMA_YIELDS_API}/chart/${poolId}`);
    return res.data;
  } catch (error) {
    throw new Error(`Failed to fetch data for pool ${poolId}: ${error.message}`);
  }
}

// Add the main entrypoint
addEntrypoint({
  key: "watch_yields",
  description: "Monitor pool metrics and emit alerts on spikes or drains",
  input: z.object({
    protocol_ids: z.array(z.string()).describe("DeFi protocols to monitor (e.g., ['lido', 'aave'])"),
    pools: z.array(z.string()).describe("Specific pool UUIDs from DefiLlama to watch (e.g., ['747c1d2a-c668-4682-b9f9-296708a3dd90'])"),
    threshold_rules: z.object({
      tvl_drop_percent: z.number().describe("Alert if TVL drops by more than this percent"),
      apy_spike_percent: z.number().describe("Alert if APY spikes by more than this percent"),
    }),
  }),
  async handler({ input }) {
    const pool_metrics = {};
    const deltas = {};
    const alerts = [];

    for (const poolId of input.pools) {
      try {
        const poolHistory = await fetchPoolData(poolId);
        if (!poolHistory || !poolHistory.data || poolHistory.data.length < 2) {
          continue; // Not enough data
        }

        // Get the last two data points
        const latest = poolHistory.data[poolHistory.data.length - 1];
        const previous = poolHistory.data[poolHistory.data.length - 2];

        // Current metrics
        const currentApy = latest.apy;
        const currentTvl = latest.tvlUsd;

        pool_metrics[poolId] = {
          apy: currentApy,
          tvl: currentTvl,
          timestamp: latest.timestamp,
        };

        // Calculate deltas
        const apyDelta = currentApy - previous.apy;
        const tvlDeltaPercent = ((currentTvl - previous.tvlUsd) / previous.tvlUsd) * 100;
        const apyDeltaPercent = ((currentApy - previous.apy) / previous.apy) * 100;

        deltas[poolId] = {
          apy_change_absolute: apyDelta,
          apy_change_percent: apyDeltaPercent,
          tvl_change_percent: tvlDeltaPercent,
        };

        // Check thresholds
        if (tvlDeltaPercent < 0 && Math.abs(tvlDeltaPercent) > input.threshold_rules.tvl_drop_percent) {
          alerts.push({
            pool: poolId,
            type: "TVL_DRAIN",
            message: `TVL dropped by ${Math.abs(tvlDeltaPercent).toFixed(2)}%`,
            timestamp: new Date().toISOString(),
          });
        }

        if (apyDeltaPercent > input.threshold_rules.apy_spike_percent) {
          alerts.push({
            pool: poolId,
            type: "APY_SPIKE",
            message: `APY spiked by ${apyDeltaPercent.toFixed(2)}%`,
            timestamp: new Date().toISOString(),
          });
        }

      } catch (e) {
        console.error(`Error processing pool ${poolId}:`, e);
      }
    }

    return {
      output: {
        pool_metrics,
        deltas,
        alerts,
      },
      usage: { total_tokens: 150 },
    };
  },
});

export default app;
