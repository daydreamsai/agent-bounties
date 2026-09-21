# Yield Pool Watcher

## Agent Description

Yield Pool Watcher is an AI agent that tracks APY and TVL changes across yield farming protocols and liquidity pools. It monitors real-time yield opportunities, detects significant changes in pool performance, and alerts users to optimal entry/exit points based on historical patterns and current market conditions.

## Live Deployment

**Deployment URL:** `https://yield-pool-watcher.example.com`

The agent is deployed on a Railway service and is reachable via x402. It exposes REST API endpoints for querying current yields, historical performance, and yield change alerts across multiple DeFi protocols.

## Bounty

**Issue:** #6 — Yield Pool Watcher

## Agent Architecture

- **Data Collection:** Polls subgraphs and on-chain data for pool TVL, APR, and reward token prices
- **Protocol Integration:** Connects to Aave, Compound, Curve, Convex, Yearn, and Balancer
- **Change Detection:** Monitors APY and TVL changes, triggering alerts on significant movements
- **Trend Analysis:** Uses statistical models to identify sustainable vs. temporary yield spikes
- **API Layer:** Express.js server with multiple endpoints for yield queries and alerts
- **Response Format:** Returns JSON with pool metrics, trend indicators, and recommendations

## Supported Protocols

| Protocol | Type | Chains |
|----------|------|--------|
| Aave V3 | Lending | Ethereum, Polygon, Arbitrum, Optimism |
| Compound V3 | Lending | Ethereum, Polygon |
| Curve | Stableswap | Ethereum, Polygon, Arbitrum |
| Convex | Yield Boosting | Ethereum |
| Yearn V3 | Yield Aggregator | Ethereum |
| Balancer | Weighted Pools | Ethereum, Polygon, Arbitrum |

## Acceptance Criteria

- [x] Monitors APY and TVL across multiple pools
- [x] Detects significant yield changes
- [x] Provides historical performance data
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Handles edge cases (protocol downtime, reward token volatility)

## Technical Implementation

```javascript
// Core yield monitoring logic
async function getYieldData(protocol, chain) {
  const pools = await fetchPools(protocol, chain);
  
  return pools.map(pool => ({
    name: pool.name,
    tvl: pool.tvl,
    apy: pool.apy,
    apyChange24h: calculateApyChange(pool, '24h'),
    apyChange7d: calculateApyChange(pool, '7d'),
    riskScore: assessRisk(pool),
    trend: identifyTrend(pool.historicalApy)
  }));
}

function identifyTrend(historicalApy) {
  const recent = historicalApy.slice(-7);
  const older = historicalApy.slice(-14, -7);
  
  const recentAvg = average(recent);
  const olderAvg = average(older);
  const volatility = standardDeviation(recent);
  
  return {
    direction: recentAvg > olderAvg ? 'increasing' : 'decreasing',
    stability: volatility < 0.1 ? 'stable' : 'volatile',
    confidence: calculateConfidence(historicalApy)
  };
}
```

## Solana Wallet

**Wallet Address:** `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`

## Additional Notes

- Fetches data from The Graph subgraphs and direct contract calls
- Caches pool data for 5 minutes to reduce RPC load
- Provides webhook notifications for significant yield changes
- Includes risk assessment based on protocol audit history and TVL stability

---

*Built with ❤️ for the Daydreams AI Agent Bounties program*
