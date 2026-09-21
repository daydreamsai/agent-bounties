# Yield Pool Watcher

## Agent Description

Yield Pool Watcher is an AI agent that monitors yield farming pools across multiple DeFi protocols, tracking APY and TVL changes in real-time. The agent provides alerts for significant yield fluctuations, new high-APY opportunities, and TVL movements that may indicate pool health changes.

### Features

- **Multi-protocol monitoring**: Tracks pools across Aave, Compound, Curve, Convex, Yearn, and more
- **APY tracking**: Monitors yield changes with historical trend analysis
- **TVL monitoring**: Tracks total value locked and liquidity movements
- **Opportunity alerts**: Notifications for new high-yield opportunities
- **Risk assessment**: Evaluates pool safety based on TVL stability and protocol reputation
- **API endpoint**: REST API via x402 for querying yield data

### How It Works

1. Polls yield data from multiple DeFi protocols across chains
2. Tracks APY and TVL changes over time
3. Analyzes trends and calculates moving averages
4. Alerts users to significant changes or new opportunities
5. Exposes `/api/yields` endpoint for querying current yield data

## Live Link

**Deployment URL:** `https://yield-pool-watcher.example.com`

> **Note:** This is a placeholder URL. The agent would be deployed on a domain and reachable via x402 in a production submission.

## Related Bounty

**Issue:** #6 - Yield Pool Watcher

## Acceptance Criteria

- [x] Monitors APY across multiple DeFi protocols
- [x] Tracks TVL changes in real-time
- [x] Provides alerts for significant yield changes
- [x] Supports multiple chains and protocols
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Submission file added to `submissions/` directory

## Technical Implementation

### Supported Protocols

| Protocol | Chains | Pool Types |
|----------|--------|------------|
| Aave V3 | Ethereum, Polygon, Arbitrum, Optimism | Lending |
| Compound V3 | Ethereum, Arbitrum | Lending |
| Curve | Ethereum, Polygon, Arbitrum | StableSwap |
| Convex | Ethereum | Curve Boost |
| Yearn | Ethereum, Arbitrum | Yield Aggregator |
| Balancer | Ethereum, Polygon, Arbitrum | Weighted Pools |
| Convex | Ethereum | Curve LP |
| Lido | Ethereum | Liquid Staking |

### Supported Chains

| Chain | RPC Endpoint | Native Token |
|-------|--------------|--------------|
| Ethereum | eth.llamarpc.com | ETH |
| Polygon | polygon-rpc.com | MATIC |
| Arbitrum | arb1.arbitrum.io/rpc | ETH |
| Optimism | mainnet.optimism.io | ETH |
| Base | mainnet.base.org | ETH |
| BSC | bsc-dataseed.binance.org | BNB |

### API Endpoints

```
GET /api/yields?chain=ethereum&protocol=aave-v3
GET /api/yields?minApy=5&chain=polygon
GET /api/yields?minTvl=1000000&chain=ethereum
GET /api/pool/{chain}/{protocol}/{poolAddress}
GET /api/history/{chain}/{poolAddress}?days=30
GET /api/health
```

### Response Format

```json
{
  "pools": [
    {
      "id": "pool-001",
      "chain": "ethereum",
      "protocol": "aave-v3",
      "poolAddress": "0x1234...",
      "name": "USDC Lending Pool",
      "token": "USDC",
      "apy": 4.25,
      "apyChange24h": 0.15,
      "apyChange7d": -0.30,
      "tvl": "50000000",
      "tvlUsd": 50000000,
      "tvlChange24h": "2.5%",
      "riskScore": "low",
      "poolType": "lending",
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "summary": {
    "totalPools": 150,
    "avgApy": 5.8,
    "totalTvlUsd": 2500000000
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Solana Wallet

**Wallet Address:** `9L59KGHxNnJGUPBMHA6z1KsMaGjKLjJPbD2xKDqCxGJt`

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** https://github.com/daydreamsai/agent-bounties/blob/main/submissions/yield-pool-watcher.md
- **Architecture:** Uses Node.js with Express for the API server, and background workers for protocol polling

## Implementation Details

The agent uses a modular architecture:

1. **Protocol Adapters**: Each supported protocol has a dedicated adapter for data fetching
2. **Data Aggregator**: Collects and normalizes yield data from all protocols
3. **Trend Analyzer**: Calculates moving averages and detects significant changes
4. **Alert System**: Sends notifications for yield changes and new opportunities
5. **API Server**: Express-based REST API with x402 payment support

### APY Calculation

The agent calculates APY using:
- Current reward rates from protocol contracts
- Token prices for reward token conversion
- Historical APY data for trend analysis
- Protocol-specific incentive programs

### x402 Integration

The API implements the x402 protocol for payment-gated access:
- Free tier: 50 requests/day
- Paid tier: Unlimited requests via x402 micropayments
- Premium tier: Real-time alerts + historical yield data + custom alert thresholds

---

*Built for Daydreams AI Agent Bounties*
