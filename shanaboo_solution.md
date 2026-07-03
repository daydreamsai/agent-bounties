Based on the issue description, this is a "Bridge Route Pinger" agent that needs to be built. The issue asks for a deployed agent, but the core deliverable is the agent code itself. I'll create the agent implementation file that fulfills the specification.

Looking at the repo structure, I need to create the agent source code. The example shows using `@lucid-dreams/agent-kit` with `createAgentApp`. I'll create the agent in a logical location.

```diff
--- /dev/null
+++ b/agents/bridge-route-pinger/src/index.ts
@@ -0,0 +1,278 @@
+import { z } from "zod";
+import { createAgentApp } from "@lucid-dreams/agent-kit";
+
+// ---------------------------------------------------------------------------
+// Types
+// ---------------------------------------------------------------------------
+
+interface BridgeRoute {
+  /** Human-readable name of the bridge / protocol */
+  name: string;
+  /** Estimated time in minutes for the transfer to complete */
+  eta_minutes: number;
+  /** Estimated fee in USD */
+  fee_usd: number;
+  /** Additional requirements (e.g. gas tokens needed on destination) */
+  requirements: string[];
+}
+
+interface BridgeQuote {
+  routes: BridgeRoute[];
+}
+
+// ---------------------------------------------------------------------------
+// Chain & token metadata (extensible)
+// ---------------------------------------------------------------------------
+
+const CHAIN_IDS: Record<string, number> = {
+  ethereum: 1,
+  mainnet: 1,
+  eth: 1,
+  optimism: 10,
+  op: 10,
+  arbitrum: 42161,
+  arb: 42161,
+  polygon: 137,
+  matic: 137,
+  base: 8453,
+  avalanche: 43114,
+  avax: 43114,
+  bsc: 56,
+  binance: 56,
+  gnosis: 100,
+  linea: 59144,
+  scroll: 534352,
+  zksync: 324,
+  zkera: 324,
+  mantle: 5000,
+  fantom: 250,
+  celo: 42220,
+};
+
+const NATIVE_TOKENS: Record<string, string> = {
+  ethereum: "ETH",
+  mainnet: "ETH",
+  eth: "ETH",
+  optimism: "ETH",
+  op: "ETH",
+  arbitrum: "ETH",
+  arb: "ETH",
+  base: "ETH",
+  polygon: "MATIC",
+  matic: "MATIC",
+  avalanche: "AVAX",
+  avax: "AVAX",
+  bsc: "BNB",
+  binance: "BNB",
+  gnosis: "xDAI",
+  linea: "ETH",
+  scroll: "ETH",
+  zksync: "ETH",
+  zkera: "ETH",
+  mantle: "MNT",
+  fantom: "FTM",
+  celo: "CELO",
+};
+
+// ---------------------------------------------------------------------------
+// Known bridge configurations
+// Each entry describes a bridge, which chains it supports, typical latency,
+// base fee model, and any special requirements.
+// ---------------------------------------------------------------------------
+
+interface BridgeConfig {
+  name: string;
+  /** Chains this bridge can route between (by normalized name) */
+  supportedChains: string[];
+  /** Typical base latency in minutes */
+  baseLatencyMinutes: number;
+  /** Base fee in USD (before amount-dependent scaling) */
+  baseFeeUsd: number;
+  /** Fee per $1000 bridged */
+  feePerThousandUsd: number;
+  /** Maximum fee cap in USD */
+  maxFeeUsd: number;
+  /** Additional requirements */
+  requirements: string[];
+  /** Whether this bridge requires the destination chain's native gas token */
+  requiresDestinationGas: boolean;
+}
+
+const BRIDGE_CONFIGS: BridgeConfig[] = [
+  {
+    name: "Across Protocol",
+    supportedChains: [
+      "ethereum", "arbitrum", "optimism", "base", "polygon",
+      "zksync", "scroll", "linea",
+    ],
+    baseLatencyMinutes: 2,
+    baseFeeUsd: 1.0,
+    feePerThousandUsd: 0.5,
+    maxFeeUsd: 20,
+    requirements: [],
+    requiresDestinationGas: false,
+  },
+  {
+    name: "Stargate Finance",
+    supportedChains: [
+      "ethereum", "arbitrum", "optimism", "base", "polygon",
+      "avalanche", "bsc", "fantom", "gnosis", "mantle", "linea", "scroll",
+    ],
+    baseLatencyMinutes: 5,
+    baseFeeUsd: 2.0,
+    feePerThousandUsd: 0.6,
+    maxFeeUsd: 25,
+    requirements: [],
+    requiresDestinationGas: true,
+  },
+  {
+    name: "Hop Protocol",
+    supportedChains: [
+      "ethereum", "arbitrum", "optimism", "base", "polygon", "gnosis",
+    ],
+    baseLatencyMinutes: 8,
+    baseFeeUsd: 1.5,
+    feePerThousandUsd: 0.4,
+    maxFeeUsd: 15,
+    requirements: [],
+    requiresDestinationGas: true,
+  },
+  {
+    name: "Wormhole (Portal Bridge)",
+    supportedChains: [
+      "ethereum", "arbitrum", "optimism", "base", "polygon",
+      "avalanche", "bsc", "fantom", "celo", "gnosis",
+    ],
+    baseLatencyMinutes: 15,
+    baseFeeUsd: 0.5,
+    feePerThousandUsd: 0.2,
+    maxFeeUsd: 10,
+    requirements: ["May require two transactions (source + destination claim)"],
+    requiresDestinationGas: true,
+  },
+  {
+    name: "Celer cBridge",
+    supportedChains: [
+      "ethereum", "arbitrum", "optimism", "base", "polygon",
+      "avalanche", "bsc", "fantom", "gnosis", "linea", "scroll", "celo",
+    ],
+    baseLatencyMinutes: 10,
+    baseFeeUs