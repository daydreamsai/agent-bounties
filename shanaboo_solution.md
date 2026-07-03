Based on the issue description, I need to create a GasRoute Oracle agent that:
1. Takes chain_set, calldata_size_bytes, gas_units_est as inputs
2. Returns the cheapest chain with fee estimates, busy level, and tip hint
3. Must be deployed and reachable via x402

Since the repo only shows `readme.md` and a `submissions/` directory, I'll create the agent implementation file and a submission file. The agent will use the `@lucid-dreams/agent-kit` pattern shown in the example.

```diff
--- /dev/null
+++ b/gasroute-oracle/src/index.ts
@@ -0,0 +1,218 @@
+import { z } from "zod";
+import { createAgentApp } from "@lucid-dreams/agent-kit";
+
+// ---------------------------------------------------------------------------
+// Types
+// ---------------------------------------------------------------------------
+
+interface ChainGasInfo {
+  chain: string;
+  baseFeeGwei: number;
+  priorityFeeGwei: number;
+  nativeTokenPriceUsd: number;
+  congestionLevel: "low" | "medium" | "high" | "extreme";
+  blockTimeSec: number;
+}
+
+interface GasEstimateResult {
+  chain: string;
+  fee_native: string;
+  fee_usd: string;
+  busy_level: string;
+  tip_hint: string;
+}
+
+// ---------------------------------------------------------------------------
+// Chain gas configuration (would be replaced by live RPC/API calls in prod)
+// ---------------------------------------------------------------------------
+
+const CHAIN_GAS_DATA: Record<string, ChainGasInfo> = {
+  ethereum: {
+    chain: "ethereum",
+    baseFeeGwei: 25,
+    priorityFeeGwei: 2,
+    nativeTokenPriceUsd: 3200,
+    congestionLevel: "medium",
+    blockTimeSec: 12,
+  },
+  arbitrum: {
+    chain: "arbitrum",
+    baseFeeGwei: 0.1,
+    priorityFeeGwei: 0.01,
+    nativeTokenPriceUsd: 3200,
+    congestionLevel: "low",
+    blockTimeSec: 0.25,
+  },
+  optimism: {
+    chain: "optimism",
+    baseFeeGwei: 0.05,
+    priorityFeeGwei: 0.005,
+    nativeTokenPriceUsd: 3200,
+    congestionLevel: "low",
+    blockTimeSec: 2,
+  },
+  polygon: {
+    chain: "polygon",
+    baseFeeGwei: 50,
+    priorityFeeGwei: 30,
+    nativeTokenPriceUsd: 0.5,
+    congestionLevel: "medium",
+    blockTimeSec: 2,
+  },
+  base: {
+    chain: "base",
+    baseFeeGwei: 0.02,
+    priorityFeeGwei: 0.002,
+    nativeTokenPriceUsd: 3200,
+    congestionLevel: "low",
+    blockTimeSec: 2,
+  },
+  avalanche: {
+    chain: "avalanche",
+    baseFeeGwei: 25,
+    priorityFeeGwei: 1,
+    nativeTokenPriceUsd: 35,
+    congestionLevel: "low",
+    blockTimeSec: 2,
+  },
+  bsc: {
+    chain: "bsc",
+    baseFeeGwei: 3,
+    priorityFeeGwei: 1,
+    nativeTokenPriceUsd: 600,
+    congestionLevel: "medium",
+    blockTimeSec: 3,
+  },
+  gnosis: {
+    chain: "gnosis",
+    baseFeeGwei: 2,
+    priorityFeeGwei: 1,
+    nativeTokenPriceUsd: 200,
+    congestionLevel: "low",
+    blockTimeSec: 5,
+  },
+};
+
+// ---------------------------------------------------------------------------
+// Gas calculation helpers
+// ---------------------------------------------------------------------------
+
+/**
+ * Estimate total gas cost in native token units for a transaction.
+ *
+ * For simple transfers: 21,000 gas
+ * For contract calls: gas_units_est + calldata overhead
+ *
+ * Calldata cost: 16 gas per non-zero byte, 4 gas per zero byte.
+ * We use a conservative average of 10 gas/byte for mixed calldata.
+ */
+function estimateTotalGasUnits(
+  gasUnitsEst: number,
+  calldataSizeBytes: number
+): number {
+  const calldataGasCost = calldataSizeBytes * 10;
+  return gasUnitsEst + calldataGasCost;
+}
+
+/**
+ * Calculate fee in native token (ETH, MATIC, AVAX, etc.)
+ * totalGasUnits * (baseFee + priorityFee) in gwei, converted to ether
+ */
+function calculateNativeFee(
+  totalGasUnits: number,
+  baseFeeGwei: number,
+  priorityFeeGwei: number
+): number {
+  const totalFeeGwei = totalGasUnits * (baseFeeGwei + priorityFeeGwei);
+  return totalFeeGwei / 1e9; // Convert gwei to native token units
+}
+
+/**
+ * Calculate fee in USD
+ */
+function calculateUsdFee(nativeFee: number, nativeTokenPriceUsd: number): number {
+  return nativeFee * nativeTokenPriceUsd;
+}
+
+/**
+ * Get a human-readable tip hint based on congestion and priority fee
+ */
+function getTipHint(
+  congestionLevel: string,
+  priorityFeeGwei: number
+): string {
+  switch (congestionLevel) {
+    case "low":
+      return `Low congestion. Suggested priority fee: ${priorityFeeGwei} gwei. Transaction likely to confirm quickly.`;
+    case "medium":
+      return `Moderate congestion. Suggested priority fee: ${priorityFeeGwei} gwei. Expect normal confirmation time.`;
+    case "high":
+      return `High congestion. Suggested priority fee: ${priorityFeeGwei} gwei. Consider waiting or increasing tip for faster inclusion.`;
+    case "extreme":
+      return `Extreme congestion! Suggested priority fee: ${priorityFeeGwei} gwei. Strongly recommend delaying non-urgent transactions.`;
+    default:
+      return `Suggested priority fee: ${priorityFeeGwei} gwei.`;
+  }
+}
+
+// ---------------------------------------------------------------------------
+// Agent definition
+// ---------------------------------------------------------------------------
+
+const { app, addEntrypoint } = createAgent