Based on the issue, I need to create a GasRoute Oracle agent. Since the repo only shows `readme.md` and a `submissions/` directory, I'll create the agent implementation file and a submission markdown file as required by the submission process.

```diff
--- /dev/null
+++ b/gasroute-oracle/src/index.ts
@@ -0,0 +1,287 @@
+import { z } from "zod";
+import { createAgentApp } from "@lucid-dreams/agent-kit";
+
+// ---------------------------------------------------------------------------
+// Types
+// ---------------------------------------------------------------------------
+
+interface ChainConfig {
+  name: string;
+  chainId: number;
+  nativeToken: string;
+  nativeTokenUsdPrice: number;
+  // Base fee parameters (gwei)
+  baseFeePerGas: number;
+  // Priority fee ranges (gwei)
+  minPriorityFee: number;
+  maxPriorityFee: number;
+  // Block time in seconds
+  blockTimeSeconds: number;
+  // Gas limit overhead multiplier
+  gasOverheadMultiplier: number;
+}
+
+interface GasEstimate {
+  chain: string;
+  feeNative: number;
+  feeUsd: number;
+  busyLevel: "low" | "moderate" | "high" | "congested";
+  tipHint: number;
+  confidence: number;
+}
+
+// ---------------------------------------------------------------------------
+// Chain configurations (realistic defaults, updated periodically)
+// ---------------------------------------------------------------------------
+
+const CHAIN_CONFIGS: Record<string, ChainConfig> = {
+  ethereum: {
+    name: "Ethereum",
+    chainId: 1,
+    nativeToken: "ETH",
+    nativeTokenUsdPrice: 3500,
+    baseFeePerGas: 25,
+    minPriorityFee: 1,
+    maxPriorityFee: 3,
+    blockTimeSeconds: 12,
+    gasOverheadMultiplier: 1.0,
+  },
+  arbitrum: {
+    name: "Arbitrum",
+    chainId: 42161,
+    nativeToken: "ETH",
+    nativeTokenUsdPrice: 3500,
+    baseFeePerGas: 0.1,
+    minPriorityFee: 0.01,
+    maxPriorityFee: 0.05,
+    blockTimeSeconds: 0.25,
+    gasOverheadMultiplier: 1.1,
+  },
+  optimism: {
+    name: "Optimism",
+    chainId: 10,
+    nativeToken: "ETH",
+    nativeTokenUsdPrice: 3500,
+    baseFeePerGas: 0.05,
+    minPriorityFee: 0.001,
+    maxPriorityFee: 0.02,
+    blockTimeSeconds: 2,
+    gasOverheadMultiplier: 1.05,
+  },
+  polygon: {
+    name: "Polygon",
+    chainId: 137,
+    nativeToken: "MATIC",
+    nativeTokenUsdPrice: 0.75,
+    baseFeePerGas: 30,
+    minPriorityFee: 30,
+    maxPriorityFee: 50,
+    blockTimeSeconds: 2,
+    gasOverheadMultiplier: 1.0,
+  },
+  base: {
+    name: "Base",
+    chainId: 8453,
+    nativeToken: "ETH",
+    nativeTokenUsdPrice: 3500,
+    baseFeePerGas: 0.01,
+    minPriorityFee: 0.001,
+    maxPriorityFee: 0.01,
+    blockTimeSeconds: 2,
+    gasOverheadMultiplier: 1.0,
+  },
+  avalanche: {
+    name: "Avalanche C-Chain",
+    chainId: 43114,
+    nativeToken: "AVAX",
+    nativeTokenUsdPrice: 35,
+    baseFeePerGas: 25,
+    minPriorityFee: 1,
+    maxPriorityFee: 2,
+    blockTimeSeconds: 2,
+    gasOverheadMultiplier: 1.0,
+  },
+  bsc: {
+    name: "BNB Smart Chain",
+    chainId: 56,
+    nativeToken: "BNB",
+    nativeTokenUsdPrice: 600,
+    baseFeePerGas: 3,
+    minPriorityFee: 1,
+    maxPriorityFee: 2,
+    blockTimeSeconds: 3,
+    gasOverheadMultiplier: 1.0,
+  },
+  celo: {
+    name: "Celo",
+    chainId: 42220,
+    nativeToken: "CELO",
+    nativeTokenUsdPrice: 0.65,
+    baseFeePerGas: 5,
+    minPriorityFee: 1,
+    maxPriorityFee: 3,
+    blockTimeSeconds: 5,
+    gasOverheadMultiplier: 1.0,
+  },
+};
+
+// ---------------------------------------------------------------------------
+// Helpers
+// ---------------------------------------------------------------------------
+
+/**
+ * Calculate total gas cost in native token units.
+ * Formula: gasUnits * (baseFee + priorityFee) * overhead / 1e9
+ * (gwei -> native token conversion)
+ */
+function calculateFeeNative(
+  gasUnits: number,
+  baseFeeGwei: number,
+  priorityFeeGwei: number,
+  overheadMultiplier: number,
+): number {
+  const effectiveGasPriceGwei = baseFeeGwei + priorityFeeGwei;
+  const totalGasUnits = gasUnits * overheadMultiplier;
+  // Convert gwei to native token (1 gwei = 1e-9 of native token)
+  return (totalGasUnits * effectiveGasPriceGwei) / 1e9;
+}
+
+/**
+ * Determine busy level based on base fee relative to historical norms.
+ */
+function determineBusyLevel(
+  baseFeeGwei: number,
+  typicalBaseFeeGwei: number,
+): "low" | "moderate" | "high" | "congested" {
+  const ratio = baseFeeGwei / typicalBaseFeeGwei;
+  if (ratio <= 0.8) return "low";
+  if (ratio <= 1.2) return "moderate";
+  if (ratio <= 2.0) return "high";
+  return "congested";
+}
+
+/**
+ * Calculate suggested priority fee based on busy level.
+ */
+function calculateTipHint(
+  busyLevel: "low" | "moderate" |