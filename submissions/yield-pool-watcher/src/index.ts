/**
 * Yield Pool Watcher Agent
 *
 * Monitors DeFi yield pools for APY and TVL changes using data from DeFi Llama.
 * Built with @lucid-dreams/agent-kit.
 */

import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import {
  fetchAllPools,
  filterByProtocols,
  filterByPoolIds,
  fetchPoolChart,
  type PoolData,
} from "./defillama.js";
import {
  checkThresholds,
  computeDeltas,
  DEFAULT_THRESHOLDS,
  type ThresholdRules,
} from "./alerts.js";

// ---------------------------------------------------------------------------
// In-memory snapshot store (tracks previous values for delta computation)
// ---------------------------------------------------------------------------
const snapshotStore = new Map<string, { apy: number; tvlUsd: number; ts: number }>();

function updateSnapshots(pools: PoolData[]) {
  const now = Date.now();
  for (const p of pools) {
    snapshotStore.set(p.pool, { apy: p.apy, tvlUsd: p.tvlUsd, ts: now });
  }
}

// ---------------------------------------------------------------------------
// Agent setup
// ---------------------------------------------------------------------------
const { app, addEntrypoint } = createAgentApp({
  name: "yield-pool-watcher",
  version: "0.1.0",
  description:
    "Track APY and TVL across DeFi yield pools and alert on sharp changes. Powered by DeFi Llama data.",
});

// ---------------------------------------------------------------------------
// Entrypoint: monitor_pools — main monitoring loop
// ---------------------------------------------------------------------------
addEntrypoint({
  key: "monitor_pools",
  description:
    "Fetch current pool data, compare with previous snapshots, and return any triggered alerts. " +
    "Accepts protocol IDs and/or specific pool IDs to narrow the watch list.",
  input: z.object({
    protocol_ids: z
      .array(z.string())
      .optional()
      .describe("DeFi protocol names to monitor (e.g. ['aave-v3', 'lido'])"),
    pools: z
      .array(z.string())
      .optional()
      .describe("Specific DeFi Llama pool IDs to watch"),
    threshold_rules: z
      .object({
        apyChangePercent: z.number().optional(),
        tvlChangePercent: z.number().optional(),
        minTvlUsd: z.number().optional(),
      })
      .optional()
      .describe("Custom alert thresholds"),
  }),
  async handler({ input }) {
    // 1. Fetch all pools
    const allPools = await fetchAllPools();

    // 2. Filter
    let watchedPools = allPools;
    if (input.protocol_ids?.length) {
      watchedPools = filterByProtocols(watchedPools, input.protocol_ids);
    }
    if (input.pools?.length) {
      const byId = filterByPoolIds(allPools, input.pools);
      watchedPools = input.protocol_ids?.length
        ? [...watchedPools, ...byId.filter((p) => !watchedPools.includes(p))]
        : byId;
    }

    // 3. Build thresholds
    const rules: ThresholdRules = {
      apyChangePercent:
        input.threshold_rules?.apyChangePercent ?? DEFAULT_THRESHOLDS.apyChangePercent,
      tvlChangePercent:
        input.threshold_rules?.tvlChangePercent ?? DEFAULT_THRESHOLDS.tvlChangePercent,
      minTvlUsd: input.threshold_rules?.minTvlUsd ?? DEFAULT_THRESHOLDS.minTvlUsd,
    };

    // 4. Check thresholds against previous snapshots
    const prevSnapshots = new Map(
      [...snapshotStore.entries()].map(([k, v]) => [k, { apy: v.apy, tvlUsd: v.tvlUsd }])
    );
    const alerts = checkThresholds(watchedPools, prevSnapshots, rules);

    // 5. Compute deltas
    const deltas = computeDeltas(watchedPools).slice(0, 100); // cap response size

    // 6. Update snapshots for next run
    updateSnapshots(watchedPools);

    // 7. Summary metrics
    const poolMetrics = watchedPools.slice(0, 50).map((p) => ({
      pool: p.pool,
      project: p.project,
      chain: p.chain,
      symbol: p.symbol,
      apy: p.apy,
      tvlUsd: p.tvlUsd,
      apyBase: p.apyBase,
      apyReward: p.apyReward,
    }));

    return {
      output: {
        pool_metrics: poolMetrics,
        deltas,
        alerts,
        summary: {
          pools_monitored: watchedPools.length,
          alerts_triggered: alerts.length,
          critical_alerts: alerts.filter((a) => a.severity === "critical").length,
          snapshot_count: snapshotStore.size,
          timestamp: new Date().toISOString(),
        },
      },
      usage: { total_tokens: watchedPools.length },
    };
  },
});

// ---------------------------------------------------------------------------
// Entrypoint: get_metrics — retrieve current metrics for specific pools
// ---------------------------------------------------------------------------
addEntrypoint({
  key: "get_metrics",
  description:
    "Get current APY, TVL, and historical data for specific pools or protocols.",
  input: z.object({
    protocol_ids: z.array(z.string()).optional(),
    pools: z.array(z.string()).optional(),
    include_chart: z
      .boolean()
      .optional()
      .describe("Include 30-day historical chart data for each pool"),
    limit: z.number().optional().describe("Max pools to return (default 20)"),
  }),
  async handler({ input }) {
    const allPools = await fetchAllPools();
    let filtered = allPools;

    if (input.protocol_ids?.length) {
      filtered = filterByProtocols(filtered, input.protocol_ids);
    }
    if (input.pools?.length) {
      const byId = filterByPoolIds(allPools, input.pools);
      filtered = input.protocol_ids?.length
        ? [...filtered, ...byId.filter((p) => !filtered.includes(p))]
        : byId;
    }

    // Sort by TVL descending
    filtered.sort((a, b) => b.tvlUsd - a.tvlUsd);
    const limit = input.limit ?? 20;
    filtered = filtered.slice(0, limit);

    // Optionally fetch chart data
    let charts: Record<string, unknown[]> | undefined;
    if (input.include_chart) {
      charts = {};
      const chartPromises = filtered.slice(0, 10).map(async (p) => {
        try {
          const data = await fetchPoolChart(p.pool);
          charts![p.pool] = data.slice(-30); // last 30 data points
        } catch {
          charts![p.pool] = [];
        }
      });
      await Promise.all(chartPromises);
    }

    const metrics = filtered.map((p) => ({
      pool: p.pool,
      project: p.project,
      chain: p.chain,
      symbol: p.symbol,
      apy: p.apy,
      apyBase: p.apyBase,
      apyReward: p.apyReward,
      tvlUsd: p.tvlUsd,
      apyPct1D: p.apyPct1D,
      apyPct7D: p.apyPct7D,
      apyPct30D: p.apyPct30D,
      stablecoin: p.stablecoin,
      ilRisk: p.ilRisk,
      exposure: p.exposure,
      ...(charts?.[p.pool] ? { chart: charts[p.pool] } : {}),
    }));

    return {
      output: {
        pool_metrics: metrics,
        count: metrics.length,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: metrics.length },
    };
  },
});

// ---------------------------------------------------------------------------
// Entrypoint: check_thresholds — evaluate thresholds against current data
// ---------------------------------------------------------------------------
addEntrypoint({
  key: "check_thresholds",
  description:
    "Check current pool data against custom thresholds and return any alerts. " +
    "Uses in-memory snapshots from previous monitor_pools calls for comparison.",
  input: z.object({
    protocol_ids: z.array(z.string()).optional(),
    pools: z.array(z.string()).optional(),
    threshold_rules: z.object({
      apyChangePercent: z.number().describe("APY change % to trigger alert"),
      tvlChangePercent: z.number().describe("TVL change % to trigger alert"),
      minTvlUsd: z.number().optional().describe("Min TVL filter (default $100K)"),
    }),
  }),
  async handler({ input }) {
    const allPools = await fetchAllPools();
    let filtered = allPools;

    if (input.protocol_ids?.length) {
      filtered = filterByProtocols(filtered, input.protocol_ids);
    }
    if (input.pools?.length) {
      const byId = filterByPoolIds(allPools, input.pools);
      filtered = input.protocol_ids?.length
        ? [...filtered, ...byId.filter((p) => !filtered.includes(p))]
        : byId;
    }

    const rules: ThresholdRules = {
      apyChangePercent: input.threshold_rules.apyChangePercent,
      tvlChangePercent: input.threshold_rules.tvlChangePercent,
      minTvlUsd: input.threshold_rules.minTvlUsd ?? DEFAULT_THRESHOLDS.minTvlUsd,
    };

    const prevSnapshots = new Map(
      [...snapshotStore.entries()].map(([k, v]) => [k, { apy: v.apy, tvlUsd: v.tvlUsd }])
    );

    const alerts = checkThresholds(filtered, prevSnapshots, rules);

    // Update snapshots
    updateSnapshots(filtered);

    return {
      output: {
        alerts,
        thresholds_applied: rules,
        pools_checked: filtered.length,
        snapshots_available: prevSnapshots.size,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: filtered.length },
    };
  },
});

// ---------------------------------------------------------------------------
// Entrypoint: get_alerts — retrieve alerts with filtering
// ---------------------------------------------------------------------------
addEntrypoint({
  key: "get_alerts",
  description:
    "Generate alerts by comparing current pool data to previous snapshots. " +
    "Supports filtering by severity, type, and protocol.",
  input: z.object({
    protocol_ids: z.array(z.string()).optional(),
    pools: z.array(z.string()).optional(),
    severity: z
      .enum(["info", "warning", "critical"])
      .optional()
      .describe("Filter alerts by minimum severity"),
    alert_type: z
      .enum(["apy_spike", "apy_drop", "tvl_spike", "tvl_drain"])
      .optional()
      .describe("Filter by alert type"),
    threshold_rules: z
      .object({
        apyChangePercent: z.number().optional(),
        tvlChangePercent: z.number().optional(),
        minTvlUsd: z.number().optional(),
      })
      .optional(),
  }),
  async handler({ input }) {
    const allPools = await fetchAllPools();
    let filtered = allPools;

    if (input.protocol_ids?.length) {
      filtered = filterByProtocols(filtered, input.protocol_ids);
    }
    if (input.pools?.length) {
      const byId = filterByPoolIds(allPools, input.pools);
      filtered = input.protocol_ids?.length
        ? [...filtered, ...byId.filter((p) => !filtered.includes(p))]
        : byId;
    }

    const rules: ThresholdRules = {
      apyChangePercent:
        input.threshold_rules?.apyChangePercent ?? DEFAULT_THRESHOLDS.apyChangePercent,
      tvlChangePercent:
        input.threshold_rules?.tvlChangePercent ?? DEFAULT_THRESHOLDS.tvlChangePercent,
      minTvlUsd: input.threshold_rules?.minTvlUsd ?? DEFAULT_THRESHOLDS.minTvlUsd,
    };

    const prevSnapshots = new Map(
      [...snapshotStore.entries()].map(([k, v]) => [k, { apy: v.apy, tvlUsd: v.tvlUsd }])
    );

    let alerts = checkThresholds(filtered, prevSnapshots, rules);

    // Apply filters
    if (input.severity) {
      const severityOrder = { info: 0, warning: 1, critical: 2 };
      const minLevel = severityOrder[input.severity];
      alerts = alerts.filter((a) => severityOrder[a.severity] >= minLevel);
    }
    if (input.alert_type) {
      alerts = alerts.filter((a) => a.type === input.alert_type);
    }

    // Update snapshots
    updateSnapshots(filtered);

    return {
      output: {
        alerts,
        filters_applied: {
          severity: input.severity ?? "all",
          alert_type: input.alert_type ?? "all",
          protocols: input.protocol_ids ?? "all",
        },
        total_alerts: alerts.length,
        timestamp: new Date().toISOString(),
      },
      usage: { total_tokens: filtered.length },
    };
  },
});

// ---------------------------------------------------------------------------
// Export the app
// ---------------------------------------------------------------------------
export default app;
