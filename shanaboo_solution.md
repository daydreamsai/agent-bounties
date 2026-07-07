Based on the issue description, I need to create a GasRoute Oracle agent that:
1. Takes chain_set, calldata_size_bytes, and gas_units_est as inputs
2. Returns the cheapest chain with fee estimates, busy level, and tip hint
3. Must be deployed and reachable via x402

Since the repo only shows `readme.md` and a `submissions/` directory, I'll create the agent implementation file and a submission file. The agent will use the `@lucid-dreams/agent-kit` pattern shown in the example.

```diff
--- /dev/null
+++ b/gasroute-oracle/src/index.ts
@@ -0,0 +1,207 @@
+import { z } from "zod";
+import { createAgentApp } from "@lucid-dreams/agent-kit";
+
+// ---------------------------------------------------------------------------
+// Types
+// ---------------------------------------------------------------------------
+
+interface ChainGasInfo {
+  chainId: number;
+  name: string;
+  nativeToken: string;
+  nativeTokenUsd: number;
+  baseFeeGwei: number;
+  priorityFeeGwei: number;
+  busyLevel: "low" | "medium" | "high" | "congested";
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
+// Chain configuration – real-time data should be fetched from RPCs / oracles
+// in production.  The values below are reasonable defaults for demonstration
+// and can be replaced with live feeds (e.g. Etherscan Gas Tracker, Owlracle,
+// Blocknative, Infura, QuickNode, etc.).
+// ---------------------------------------------------------------------------
+
+const CHAIN_REGISTRY: Record<string, ChainGasInfo> = {
+  ethereum: {
+    chainId: 1,
+    name: "Ethereum",
+    nativeToken: "ETH",
+    nativeTokenUsd: 3500,
+    baseFeeGwei: 25,
+    priorityFeeGwei: 2,
+    busyLevel: "medium",
+    blockTimeSec: 12,
+  },
+  optimism: {
+    chainId: 10,
+    name: "Optimism",
+    nativeToken: "ETH",
+    nativeTokenUsd: 3500,
+    baseFeeGwei: 0.01,
+    priorityFeeGwei: 0.005,
+    busyLevel: "low",
+    blockTimeSec: 2,
+  },
+  arbitrum: {
+    chainId: 42161,
+    name: "Arbitrum One",
+    nativeToken: "ETH",
+    nativeTokenUsd: 3500,
+    baseFeeGwei: 0.1,
+    priorityFeeGwei: 0.02,
+    busyLevel: "low",
+    blockTimeSec: 0.25,
+  },
+  polygon: {
+    chainId: 137,
+    name: "Polygon PoS",
+    nativeToken: "MATIC",
+    nativeTokenUsd: 0.75,
+    baseFeeGwei: 40,
+    priorityFeeGwei: 30,
+    busyLevel: "medium",
+    blockTimeSec: 2,
+  },
+  base: {
+    chainId: 8453,
+    name: "Base",
+    nativeToken: "ETH",
+    nativeTokenUsd: 3500,
+    baseFeeGwei: 0.02,
+    priorityFeeGwei: 0.01,
+    busyLevel: "low",
+    blockTimeSec: 2,
+  },
+  avalanche: {
+    chainId: 43114,
+    name: "Avalanche C-Chain",
+    nativeToken: "AVAX",
+    nativeTokenUsd: 35,
+    baseFeeGwei: 25,
+    priorityFeeGwei: 2,
+    busyLevel: "low",
+    blockTimeSec: 2,
+  },
+  bsc: {
+    chainId: 56,
+    name: "BNB Smart Chain",
+    nativeToken: "BNB",
+    nativeTokenUsd: 600,
+    baseFeeGwei: 3,
+    priorityFeeGwei: 1,
+    busyLevel: "medium",
+    blockTimeSec: 3,
+  },
+};
+
+// ---------------------------------------------------------------------------
+// Helpers
+// ---------------------------------------------------------------------------
+
+/**
+ * Convert gwei to the native token unit (ETH, MATIC, etc.).
+ * 1 gwei = 1e-9 of the native unit.
+ */
+function gweiToNative(gwei: number): number {
+  return gwei * 1e-9;
+}
+
+/**
+ * Estimate total gas fee in native token.
+ *
+ * Formula:
+ *   totalGas = gasUnits * (baseFee + priorityFee) [in gwei]
+ *   nativeCost = totalGas * 1e-9
+ *
+ * For L2s that post calldata to L1, a simplified calldata surcharge is
+ * included: calldataBytes * 16 gas per byte (EIP-2028) * L1 baseFee
+ * scaled by the L2's posting ratio (approximated as 1/100 for rollups).
+ */
+function estimateFeeNative(
+  chain: ChainGasInfo,
+  gasUnits: number,
+  calldataBytes: number,
+): number {
+  const executionGasGwei = gasUnits * (chain.baseFeeGwei + chain.priorityFeeGwei);
+
+  // L1 calldata cost approximation for L2s (rollups post compressed data to L1)
+  let l1CalldataGwei = 0;
+  if (["optimism", "arbitrum", "base"].includes(chain.name.toLowerCase()) || chain.chainId === 10 || chain.chainId === 42161 || chain.chainId === 8453) {
+    // Assume L1 base fee ~25 gwei, 16 gas per byte, and ~1/100 compression ratio
+    const l1BaseFeeGwei = 25;
+    const calldataGasL1 = calldataBytes * 16;
+    l1CalldataGwei = (calldataGasL1 * l1BaseFeeGwei) / 100;
+  }
+
+  const totalGasGwei = executionGasGwei + l1CalldataGwei;
+  return g