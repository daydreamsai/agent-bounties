Based on the issue, I need to create a new agent file for the Slippage Sentinel bounty. The issue specifies using `@lucid-dreams/agent-kit` with a specific structure. I'll create the agent implementation file.

```diff
--- /dev/null
+++ b/submissions/slippage-sentinel/agent.ts
@@ -0,0 +1,178 @@
+import { z } from "zod";
+import { createAgentApp } from "@lucid-dreams/agent-kit";
+
+const { app, addEntrypoint } = createAgentApp({
+  name: "slippage-sentinel",
+  version: "0.1.0",
+  description: "Estimate safe slippage tolerance for any route to prevent swap reverts",
+});
+
+// --- Helper Types & Constants ---
+
+interface PoolDepth {
+  dex: string;
+  poolAddress: string;
+  token0: string;
+  token1: string;
+  reserve0: string;
+  reserve1: string;
+  tvlUSD: number;
+}
+
+interface TradeSizeData {
+  p50: number;
+  p75: number;
+  p90: number;
+  p95: number;
+  p99: number;
+  sampleSize: number;
+  periodHours: number;
+}
+
+interface VolatilityData {
+  dailyVolatilityBps: number;
+  weeklyVolatilityBps: number;
+  monthlyVolatilityBps: number;
+}
+
+// Default fallback values when on-chain data is unavailable
+const DEFAULT_SLIPPAGE_BPS = 100; // 1%
+const HIGH_VOLATILITY_SLIPPAGE_BPS = 300; // 3%
+const STABLECOIN_SLIPPAGE_BPS = 10; // 0.1%
+const MEGA_POOL_SLIPPAGE_BPS = 5; // 0.05%
+
+// Known stablecoin addresses (Ethereum mainnet)
+const STABLECOINS = new Set([
+  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
+  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
+  "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
+  "0x8e870d67f660d95d5be530380d0ec0bd388289e1", // USDP
+  "0x853d955acef822db058eb8505911ed77f175b99e", // FRAX
+]);
+
+// --- Core Slippage Estimation Logic ---
+
+function classifyTokenRisk(token: string): "stablecoin" | "bluechip" | "midcap" | "lowcap" {
+  if (STABLECOINS.has(token.toLowerCase())) return "stablecoin";
+  // In production, this would query a token metadata service
+  // For now, use a heuristic based on address recognizability
+  return "midcap";
+}
+
+function estimateBaseSlippage(
+  amountInUSD: number,
+  poolTVLUSD: number,
+  tokenInRisk: string,
+  tokenOutRisk: string,
+): number {
+  // If both tokens are stablecoins, slippage is minimal
+  if (tokenInRisk === "stablecoin" && tokenOutRisk === "stablecoin") {
+    return STABLECOIN_SLIPPAGE_BPS;
+  }
+
+  // If pool is extremely deep relative to trade size, minimal slippage
+  if (poolTVLUSD > 0 && amountInUSD / poolTVLUSD < 0.001) {
+    return MEGA_POOL_SLIPPAGE_BPS;
+  }
+
+  // Base slippage proportional to trade size vs pool depth
+  if (poolTVLUSD > 0) {
+    const utilizationRatio = amountInUSD / poolTVLUSD;
+    // AMM constant product formula approximation: price impact ≈ utilizationRatio * 10000 bps
+    const priceImpactBps = Math.min(utilizationRatio * 10000, 5000);
+    return Math.max(priceImpactBps, 5); // minimum 5 bps
+  }
+
+  // Fallback: risk-based estimation
+  switch (tokenInRisk) {
+    case "stablecoin":
+      return 30;
+    case "bluechip":
+      return 50;
+    case "midcap":
+      return 100;
+    case "lowcap":
+      return 300;
+    default:
+      return DEFAULT_SLIPPAGE_BPS;
+  }
+}
+
+function applyVolatilityBuffer(baseSlippageBps: number, volatility: VolatilityData): number {
+  // Add buffer for recent volatility
+  const dailyBuffer = volatility.dailyVolatilityBps * 0.5;
+  const weeklyBuffer = volatility.weeklyVolatilityBps * 0.2;
+  const monthlyBuffer = volatility.monthlyVolatilityBps * 0.1;
+
+  const totalBuffer = dailyBuffer + weeklyBuffer + monthlyBuffer;
+  return baseSlippageBps + totalBuffer;
+}
+
+function applyTradeSizeBuffer(slippageBps: number, tradeSizeData: TradeSizeData): number {
+  // If our trade is larger than p95, add extra buffer
+  // This is a heuristic — in production, compare amountIn to p95
+  const p95Buffer = tradeSizeData.p95 > 0 ? (tradeSizeData.p95 / 10000) * 0.1 : 0;
+  return slippageBps + p95Buffer;
+}
+
+// --- Entrypoint ---
+
+addEntrypoint({
+  key: "estimate-slippage",
+  description: "Estimate safe slippage tolerance for a swap route",
+  input: z.object({
+    token_in: z.string().describe("Input token address"),
+    token_out: z.string().describe("Output token address"),
+    amount_in: z.string().describe("Amount to swap (in token native units)"),
+    route_hint: z.string().optional().describe("Suggested route/DEX (e.g., 'uniswap-v3', 'curve')"),
+  }),
+  async handler({ input }) {
+    const { token_in, token_out, amount_in, route_hint } = input;
+
+    // In a production deployment, these would be fetched from on-chain data