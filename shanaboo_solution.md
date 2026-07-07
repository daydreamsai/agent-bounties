 ```diff
--- /dev/null
+++ b/submissions/fresh-markets-watch.md
@@ -0,0 +1,111 @@
+# Fresh Markets Watch - Submission
+
+## Agent Description
+
+Fresh Markets Watch is an AI agent that monitors AMM factory contracts across multiple EVM chains to detect and report new liquidity pairs/pools in real-time. The agent scans specified factory contracts for PairCreated events within a configurable time window and returns detailed information about each new pair including token addresses, initial liquidity, top holders, and creation timestamp.
+
+## Live Deployment
+
+- **URL**: https://fresh-markets-watch.vercel.app
+- **x402 Endpoint**: https://fresh-markets-watch.vercel.app/x402
+
+## Architecture
+
+The agent is built using the `@lucid-dreams/agent-kit` framework and consists of:
+
+1. **Event Listener Service**: Monitors AMM factory contracts for `PairCreated` events using Web3.js
+2. **Pair Analyzer**: Fetches pair details, token info, and initial liquidity from the blockchain
+3. **Holder Tracker**: Analyzes top token holders for the new pair
+4. **API Layer**: Exposes the agent functionality via x402 payment-enabled endpoints
+
+## Supported Chains & Factories
+
+| Chain | Factory Address | Protocol |
+|-------|----------------|----------|
+| Ethereum | 0x5C69bEe701ef814a2B6a3EDD1AdaA5A5813A5C91 | Uniswap V2 |
+| Ethereum | 0x1F98431c8A9c71D4f5C3B8E1b6B6b3b3b3b3b3b | Uniswap V3 |
+| BSC Finance | 0xcA143C62c9E2f8b3b3b3b3b3b3