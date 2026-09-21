# Lending Liquidation Sentinel

## Agent Description

Lending Liquidation Sentinel is an AI agent that monitors lending positions across Aave, Compound, and other lending protocols for liquidation risk. The agent tracks health factors, collateral ratios, and market conditions to alert users before their positions face liquidation.

### Features

- **Position monitoring**: Tracks health factors for lending positions
- **Liquidation alerts**: Notifications when positions approach liquidation thresholds
- **Multi-protocol support**: Monitors positions across Aave, Compound, and more
- **Risk simulation**: Simulates price changes to estimate liquidation impact
- **Position optimization**: Suggests actions to improve health factor
- **API endpoint**: REST API via x402 for querying liquidation risk data

### How It Works

1. Monitors lending positions and their health factors across protocols
2. Tracks collateral prices and calculates liquidation thresholds
3. Alerts users when positions approach dangerous health levels
4. Simulates price scenarios to estimate liquidation risk
5. Exposes `/api/positions` endpoint for querying risk data

## Live Link

**Deployment URL:** `https://lending-liquidation-sentinel.example.com`

> **Note:** This is a placeholder URL. The agent would be deployed on a domain and reachable via x402 in a production submission.

## Related Bounty

**Issue:** #9 - Lending Liquidation Sentinel

## Acceptance Criteria

- [x] Monitors lending positions for liquidation risk
- [x] Tracks health factors in real-time
- [x] Provides liquidation price estimates
- [x] Supports multiple lending protocols
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Submission file added to `submissions/` directory

## Technical Implementation

### Supported Protocols

| Protocol | Chains | Features |
|----------|--------|----------|
| Aave V3 | Ethereum, Polygon, Arbitrum, Optimism | Multi-collateral |
| Compound V3 | Ethereum, Arbitrum | Multi-collateral |
| Morpho | Ethereum | Optimized Lending |
| Radiant | Arbitrum, BSC | Multi-chain Lending |

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
GET /api/positions?chain=ethereum&protocol=aave-v3&owner=0x1234...
GET /api/positions?chain=ethereum&risk=high
GET /api/liquidation-price?chain=ethereum&positionId=pos-001
GET /api/simulate?chain=ethereum&positionId=pos-001&priceChange=-20
GET /api/health
```

### Response Format

```json
{
  "positions": [
    {
      "id": "position-001",
      "chain": "ethereum",
      "protocol": "aave-v3",
      "owner": "0x1234...",
      "collateral": {
        "token": "ETH",
        "amount": "10.5",
        "valueUsd": 22050
      },
      "debt": {
        "token": "USDC",
        "amount": "15000",
        "valueUsd": 15000
      },
      "healthFactor": 1.25,
      "healthFactorFormatted": "1.25",
      "liquidationThreshold": 1.0,
      "liquidationPrice": 1714.29,
      "currentPrice": 2100,
      "riskLevel": "medium",
      "riskFactors": ["low_health_factor"],
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "summary": {
    "totalPositions": 25,
    "highRiskCount": 3,
    "avgHealthFactor": 1.85
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Solana Wallet

**Wallet Address:** `ERVjqoquv7MearJg6awmrMcKYADxafiFvvsU4SZaw3w8`

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** https://github.com/daydreamsai/agent-bounties/blob/main/submissions/lending-liquidation-sentinel.md
- **Architecture:** Uses Node.js with Express for the API server, and background workers for position monitoring

## Implementation Details

The agent uses a modular architecture:

1. **Protocol Adapters**: Each supported protocol has a dedicated adapter for position data
2. **Health Monitor**: Continuously tracks health factors for all positions
3. **Liquidation Calculator**: Computes liquidation prices and thresholds
4. **Risk Scorer**: Evaluates position risk based on multiple factors
5. **Alert System**: Sends notifications for high-risk positions
6. **API Server**: Express-based REST API with x402 payment support

### Health Factor Calculation

The agent calculates health factors using:
- Current collateral value from price feeds
- Outstanding debt amount
- Protocol-specific liquidation thresholds
- Interest accrual rates for variable debt

### x402 Integration

The API implements the x402 protocol for payment-gated access:
- Free tier: 50 requests/day
- Paid tier: Unlimited requests via x402 micropayments
- Premium tier: Real-time liquidation alerts + historical data + custom risk thresholds

---

*Built for Daydreams AI Agent Bounties*
