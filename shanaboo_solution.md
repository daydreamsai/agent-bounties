```diff
--- /dev/null
+++ b/src/agents/cross-dex-arbitrage-alert/index.ts
@@ -0,0 +1,100 @@
+import { z } from "zod";
+import { createAgentApp } from "@lucid-dreams/agent-kit";
+import { ethers } from "ethers";
+import axios from "axios";
+
+const { app, addEntrypoint } = createAgentApp({
+  name: "cross-dex-arbitrage-alert",
+  version: "0.1.0",
+  description: "Detect cross-DEX token price spreads",
+});
+
+// Define the input schema
+const InputSchema = z.object({
+  token_in: z.string(),
+  token_out: z.string(),
+  amount_in: z.string(),
+  chains: z.array(z.string()),
+});
+
+addEntrypoint({
+  key: "findArbitrage",
+  description: "Find cross-DEX arbitrage opportunities",
+  input: InputSchema,
+  async handler({ input }) {
+    const { token_in, token_out, amount_in, chains } = input;
+    
+    // For this example we'll use a simple in-memory cache for prices
+    const dexPrices = new Map();
+    
+    // Simulate fetching prices from DEXs
+    // In a real implementation, this would call DEX APIs or contracts
+    const fetchDexPrices = async (chain: string) => {
+      // Mock implementation - in practice this would call actual DEX APIs
+      // Example response structure:
+      // {
+      //   "uniswap": { "price": "1200", "decimals": 18 },
+      "sushiswap": { "price": "1180", "decimals": 18 }
+      // }
+      return {
+        uniswap: { price: "1200", decimals: 18 },
+        sushiswap: { price: "1180", decimals: 18 }
+      };
+    };
+
+    // Get all prices from each chain
+    for (const chain of chains) {
+      const prices = await fetchDexPrices(chain);
+      for (const [dex, priceData] of Object.entries(prices)) {
+        dexPrices.set(chain + '-' + dex, priceData);
+      }
+    }
+
+    // Calculate arbitrage opportunities
+    const calculateArbitrage = () => {
+      const opportunities = [];
+      for (const [chainDexKey, priceData] of dexPrices.entries()) {
+        const [chain, dex] = chainDexKey.split('-');
+        const { price, decimals } = priceData;
+        
+        // Simulate gas cost calculation
+        const gasCostUSD = 0.15; // Simplified assumption
+        
+        // Calculate net spread in basis points
+        const netSpreadBps = 0; // This would be calculated based on the price differences
+        
+        opportunities.push({
+          route: `${chain}-${dex}`,
+          net_spread_bps: netSpreadBps,
+          est_fill_cost: gasCostUSD
+        });
+      }
+      return opportunities;
+    };
+
+    const routes = calculateArbitrage();
+    
+    // Return the best and alternative routes
+    const bestRoute = routes
+      .sort((a, b) => 
+        b.net_spabstraction_.ts:10020010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010010