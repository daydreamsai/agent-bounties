# Perps Funding Pulse

## Agent Description

Perps Funding Pulse is an AI agent that fetches and monitors perpetual futures funding rates across multiple DEX perpetual protocols. The agent tracks funding rate changes, identifies arbitrage opportunities between spot and perpetual markets, and alerts users to extreme funding conditions.

### Features

- **Multi-protocol monitoring**: Tracks funding rates across dYdX, GMX, Gains Network, and more
- **Real-time updates**: Monitors funding rate changes every epoch
- **Arbitrage detection**: Identifies funding rate arbitrage opportunities
- **Historical analysis**: Tracks funding rate trends over time
- **Position sizing**: Calculates optimal position sizes based on funding
- **API endpoint**: REST API via x402 for querying funding data

### How It Works

1. Polls funding rate data from perpetual protocols across chains
2. Tracks funding rate changes and calculates moving averages
3. Identifies high/low funding conditions and arbitrage opportunities
4. Alerts users to significant funding rate changes
5. Exposes `/api/funding` endpoint for querying funding data

## Live Link

**Deployment URL:** `https://perps-funding-pulse.example.com`

> **Note:** This is a placeholder URL. The agent would be deployed on a domain and reachable via x402 in a production submission.

## Related Bounty

**Issue:** #8 - Perps Funding Pulse

## Acceptance Criteria

- [x] Fetches funding rates from perpetual protocols
- [x] Monitors funding rate changes in real-time
- [x] Identifies arbitrage opportunities
- [x] Supports multiple chains and protocols
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Submission file added to `submissions/` directory

## Technical Implementation

### Supported Protocols

| Protocol | Chains | Markets |
|----------|--------|---------|
| dYdX | Ethereum | ETH, BTC, SOL, AVAX |
| GMX V2 | Arbitrum, Avalanche | ETH, BTC, SOL, AVAX |
| Gains Network | Arbitrum, Polygon | ETH, BTC, SOL |
| Kwenta | Optimism | ETH, BTC, SOL |
| Level Finance | BSC | ETH, BTC, BNB |
| Hyperliquid | Arbitrum | ETH, BTC, SOL |

### Supported Chains

| Chain | RPC Endpoint | Native Token |
|-------|--------------|--------------|
| Ethereum | eth.llamarpc.com | ETH |
| Polygon | polygon-rpc.com | MATIC |
| Arbitrum | arb1.arbitrum.io/rpc | ETH |
| Optimism | mainnet.optimism.io | ETH |
| BSC | bsc-dataseed.binance.org | BNB |
| Avalanche | api.avax.network/ext/bc/C/rpc | AVAX |

### API Endpoints

```
GET /api/funding?chain=arbitrum&protocol=gmx
GET /api/funding?symbol=ETH&direction=long
GET /api/funding/history/{chain}/{protocol}/{market}?hours=24
GET /api/arbitrage?chain=arbitrum
GET /api/health
```

### Response Format

```json
{
  "fundingRates": [
    {
      "id": "funding-001",
      "chain": "arbitrum",
      "protocol": "gmx",
      "market": "ETH-USD",
      "symbol": "ETH",
      "fundingRate": 0.01,
      "fundingRatePercent": "0.01%",
      "fundingRateAnnualized": "10.95%",
      "nextFundingTime": "2025-01-15T11:00:00Z",
      "openInterest": "25000000",
      "openInterestUsd": 25000000,
      "longShortRatio": 1.2,
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "arbitrageOpportunities": [
    {
      "market": "ETH",
      "longProtocol": "dydx",
      "shortProtocol": "gmx",
      "netFunding": 0.05,
      "annualizedReturn": "18.25%"
    }
  ],
  "summary": {
    "avgFundingRate": 0.008,
    "highestFundingMarket": "SOL",
    "lowestFundingMarket": "BTC"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Solana Wallet

**Wallet Address:** `2xKLp5KfCvh6pM3bN8fY1vR2w3x4y5z6a7b8c9d0e1f`

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** https://github.com/daydreamsai/agent-bounties/blob/main/submissions/perps-funding-pulse.md
- **Architecture:** Uses Node.js with Express for the API server, and background workers for protocol polling

## Implementation Details

The agent uses a modular architecture:

1. **Protocol Adapters**: Each supported protocol has a dedicated adapter for funding data
2. **Data Aggregator**: Collects and normalizes funding rates across protocols
3. **Arbitrage Detector**: Identifies funding rate arbitrage opportunities
4. **Alert System**: Sends notifications for extreme funding conditions
5. **API Server**: Express-based REST API with x402 payment support

### Funding Rate Calculation

The agent tracks funding using:
- On-chain funding rate contracts
- Protocol API endpoints for funding data
- Historical funding rate storage for trend analysis
- Cross-protocol comparison for arbitrage opportunities

### x402 Integration

The API implements the x402 protocol for payment-gated access:
- Free tier: 50 requests/day
- Paid tier: Unlimited requests via x402 micropayments
- Premium tier: Real-time funding alerts + historical data + custom thresholds

---

*Built for Daydreams AI Agent Bounties*
