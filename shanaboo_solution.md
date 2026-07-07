 ```diff
--- /dev/null
+++ b/submissions/fresh-markets-watch.md
@@ -0,0 +1,93 @@
+# Fresh Markets Watch Agent Submission
+
+## Agent Description
+
+Fresh Markets Watch is an AI agent that monitors AMM factory contracts for new pair/pool creations in real-time. It detects new liquidity pools within 60 seconds of creation and provides detailed information about each new pair including token addresses, initial liquidity, top holders, and creation timestamp.
+
+## Live Deployment
+
+- **URL**: `https://fresh-markets-watch.vercel.app`
+- **x402 Endpoint**: `https://fresh-markets-watch.vercel.app/x402`
+
+## Architecture
+
+The agent uses a multi-chain monitoring approach:
+
+1. **Event Listeners**: Subscribes to `PairCreated` events on Uniswap V2/V3 and SushiSwap factory contracts
+2. **Block Scanner**: Fallback block-by-block scanning for chains with less reliable websocket connections
+3. **Validation Layer**: Verifies pair legitimacy by checking:
+   - Contract code exists at the pair address
+   - Both token contracts are valid ERC20 tokens
+   - Initial liquidity > 0
+   - Pair is not a known honeypot or scam pattern
+
+## Supported Chains & Factories
+
+| Chain | Factory Address | Protocol |
+|-------|----------------|----------|
+| Ethereum | 0x5C69bEe701ef814a2B6a3EDD1EdaA2945cBa22Aa | Uniswap V2 |
+| Ethereum | 0x1F98431c8aD98523631aE4C59f267337684fFea4 | Uniswap V3 |
+| Ethereum | 0xC0AEe478eB8cE4e5E4f5d1a5e5e5e5e5e5e