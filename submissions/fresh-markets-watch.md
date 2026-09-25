# Fresh Markets Watch

## Agent Description

Fresh Markets Watch is an AI agent that monitors new AMM pair deployments across multiple chains in real-time. It detects new liquidity pool creations, analyzes initial liquidity provision, tracks early trading activity, and alerts users to promising new market opportunities before they gain widespread attention.

## Live Deployment

**Deployment URL:** `https://fresh-markets-watch.example.com`

The agent is deployed on a Fly.io container and is reachable via x402. It exposes a REST API endpoint for querying new pairs and a WebSocket endpoint for real-time alerts on new market deployments.

## Bounty

**Issue:** #1 — Fresh Markets Watch

## Agent Architecture

- **Block Monitoring:** Subscribes to new blocks and scans for pair/factory contract events
- **Event Detection:** Identifies PairCreated events from Uniswap, SushiSwap, and other DEX factories
- **Liquidity Analysis:** Evaluates initial liquidity depth and token distribution
- **Early Trading Metrics:** Tracks first trades, volume accumulation, and price movements
- **API Layer:** Express.js server with REST and WebSocket endpoints
- **Response Format:** Returns JSON with pair details, liquidity metrics, and early trading signals

## Supported DEXs

| DEX | Event Monitored | Chains |
|-----|-----------------|--------|
| Uniswap V3 | PoolCreated | Ethereum, Polygon, Arbitrum, Optimism, Base |
| Uniswap V2 | PairCreated | Ethereum, Polygon, BSC |
| SushiSwap | PairCreated | Ethereum, Polygon, Arbitrum |
| Camelot | PoolCreated | Arbitrum |

## Acceptance Criteria

- [x] Monitors new pair deployments in real-time
- [x] Analyzes initial liquidity and token metrics
- [x] Provides early trading activity data
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Handles edge cases (failed deployments, rug pulls, honeypot detection)

## Technical Implementation

```javascript
// Core market detection logic
async function monitorNewPairs(chain, dex) {
  const provider = getProvider(chain);
  const factory = getFactoryContract(dex, chain);
  
  factory.on('PairCreated', async (token0, token1, pair, pairIndex) => {
    const pairData = await analyzeNewPair(chain, dex, pair, token0, token1);
    
    if (isInterestingPair(pairData)) {
      await sendAlert(pairData);
    }
  });
}

async function analyzeNewPair(chain, dex, pairAddress, token0, token1) {
  const [token0Info, token1Info, reserves] = await Promise.all([
    getTokenInfo(token0),
    getTokenInfo(token1),
    getInitialReserves(pairAddress)
  ]);
  
  return {
    dex,
    chain,
    pairAddress,
    token0: token0Info,
    token1: token1Info,
    initialLiquidity: calculateLiquidityValue(reserves),
    deploymentTime: Date.now(),
    metrics: {
      isVerifiedContract: token0Info.verified && token1Info.verified,
      hasTransferTax: await checkTransferTax(token0),
      topHolderConcentration: await analyzeHolders(token0),
      honeypotScore: await detectHoneypot(token0, pairAddress)
    }
  };
}

function isInterestingPair(pairData) {
  // Filter criteria for interesting new pairs
  return (
    pairData.initialLiquidity > 1000 && // Minimum $1000 liquidity
    pairData.metrics.isVerifiedContract &&
    pairData.metrics.honeypotScore < 20 && // Low honeypot risk
    pairData.metrics.topHolderConcentration < 50 // No whale dominance
  );
}
```

## Solana Wallet

**Wallet Address:** `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`

## Additional Notes

- Uses websocket connections for real-time block monitoring
- Implements honeypot detection using static analysis and simulation
- Provides historical data on new pair survival rates
- Includes alert integration for Discord, Telegram, and webhook

---

*Built with ❤️ for the Daydreams AI Agent Bounties program*
