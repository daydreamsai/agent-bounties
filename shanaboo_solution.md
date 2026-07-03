Based on the issue description, I need to create a complete agent implementation for the Cross DEX Arbitrage Alert. The issue specifies using `@lucid-dreams/agent-kit` with a specific pattern shown in the example. I'll create the agent implementation file and a submission file.

```diff
--- /dev/null
+++ b/agents/cross-dex-arbitrage-alert/src/index.ts
@@ -0,0 +1,287 @@
+import { z } from "zod";
+import { createAgentApp } from "@lucid-dreams/agent-kit";
+
+// --- Types ---
+
+interface TokenPrice {
+  dex: string;
+  chain: string;
+  price: number; // price of token_out per token_in
+  feeBps: number; // DEX fee in basis points
+  gasEstimateUsd: number; // estimated gas cost in USD
+  liquidityUsd: number; // available liquidity in USD
+}
+
+interface ArbitrageRoute {
+  buyDex: string;
+  buyChain: string;
+  sellDex: string;
+  sellChain: string;
+  buyPrice: number;
+  sellPrice: number;
+  grossSpreadBps: number;
+  netSpreadBps: number;
+  estimatedProfitUsd: number;
+  totalCostUsd: number;
+  route: string[];
+}
+
+interface ArbitrageResult {
+  best_route: ArbitrageRoute | null;
+  alt_routes: ArbitrageRoute[];
+  net_spread_bps: number;
+  est_fill_cost: number;
+}
+
+// --- Constants ---
+
+// Common DEX fee structures (in basis points)
+const DEX_FEES: Record<string, number> = {
+  uniswap_v3: 30,    // 0.3% default pool
+  uniswap_v2: 30,
+  sushiswap: 30,
+  pancakeswap: 25,
+  curve: 4,          // 0.04% for stable pools
+  balancer: 10,      // 0.1% typical
+  quickswap: 30,
+  trader_joe: 30,
+  orca: 30,
+  raydium: 25,
+  serum: 10,
+};
+
+// Approximate gas costs per chain (in USD, updated periodically)
+const CHAIN_GAS_ESTIMATES: Record<string, number> = {
+  ethereum: 15.0,
+  arbitrum: 0.3,
+  optimism: 0.2,
+  polygon: 0.05,
+  base: 0.15,
+  bsc: 0.1,
+  avalanche: 0.3,
+  solana: 0.00025,
+};
+
+// Bridge cost estimates (in USD)
+const BRIDGE_COST_ESTIMATES: Record<string, Record<string, number>> = {
+  ethereum: { arbitrum: 5, optimism: 5, polygon: 8, base: 5, bsc: 10, avalanche: 12, solana: 15 },
+  arbitrum: { ethereum: 3, optimism: 2, polygon: 5, base: 2, bsc: 8, avalanche: 8, solana: 12 },
+  optimism: { ethereum: 3, arbitrum: 2, polygon: 5, base: 1, bsc: 8, avalanche: 8, solana: 12 },
+  polygon: { ethereum: 5, arbitrum: 3, optimism: 3, base: 3, bsc: 4, avalanche: 5, solana: 10 },
+  base: { ethereum: 3, arbitrum: 2, optimism: 1, polygon: 5, bsc: 8, avalanche: 8, solana: 12 },
+  bsc: { ethereum: 8, arbitrum: 5, optimism: 5, polygon: 4, base: 5, avalanche: 5, solana: 10 },
+  avalanche: { ethereum: 8, arbitrum: 5, optimism: 5, polygon: 4, base: 5, bsc: 5, solana: 10 },
+  solana: { ethereum: 10, arbitrum: 8, optimism: 8, polygon: 6, base: 8, bsc: 8, avalanche: 8 },
+};
+
+// --- Mock Price Feed (simulates on-chain quotes) ---
+
+/**
+ * Simulates fetching token prices from various DEXs across chains.
+ * In production, this would query actual DEX routers/APIs.
+ */
+async function fetchPrices(
+  tokenIn: string,
+  tokenOut: string,
+  amountIn: number,
+  chains: string[]
+): Promise<TokenPrice[]> {
+  // Deterministic mock based on input parameters to simulate real price variance
+  const prices: TokenPrice[] = [];
+  const basePrice = 1.0 + (hashString(tokenIn + tokenOut) % 100) / 10000; // 1.0 - 1.01 base
+
+  const dexes = ["uniswap_v3", "sushiswap", "curve", "balancer", "pancakeswap"];
+
+  for (const chain of chains) {
+    for (const dex of dexes) {
+      // Simulate price variance per DEX/chain
+      const variance = ((hashString(chain + dex + tokenIn) % 200) - 100) / 10000; // -1% to +1%
+      const price = basePrice + variance;
+      const feeBps = DEX_FEES[dex] ?? 30;
+      const gasEstimateUsd = CHAIN_GAS_ESTIMATES[chain] ?? 1.0;
+      const liquidityUsd = 100000 + (hashString(chain + dex) % 900000);
+
+      prices.push({
+        dex,
+        chain,
+        price,
+        feeBps,
+        gasEstimateUsd,
+        liquidityUsd,
+      });
+    }
+  }
+
+  return prices;
+}
+
+// --- Helpers ---
+
+function hashString(s: string): number {
+  let hash = 0;
+  for (let i = 0; i < s.length; i++) {
+    const char = s.charCodeAt(i);
+    hash = ((hash << 5) - hash) + char;
+    hash |= 0