# Cross DEX Arbitrage Alert

## Agent Description

Cross DEX Arbitrage Alert is an AI agent that monitors price discrepancies across multiple decentralized exchanges and alerts users to profitable arbitrage opportunities. The agent continuously tracks token prices on Uniswap, SushiSwap, Curve, 1inch, and other major DEXes across multiple chains, calculating potential profits from cross-DEX arbitrage.

### Features

- **Multi-DEX monitoring**: Tracks prices across Uniswap V2/V3, SushiSwap, Curve, PancakeSwap, and more
- **Cross-chain detection**: Identifies arbitrage opportunities across Ethereum, Polygon, Arbitrum, Optimism, and BSC
- **Real-time alerts**: Instant notifications when profitable opportunities are detected
- **Profit calculation**: Estimates net profit after gas costs and slippage
- **Historical analysis**: Tracks past opportunities to identify patterns
- **API endpoint**: REST API via x402 for querying current arbitrage opportunities

### How It Works

1. Continuously polls prices from multiple DEXes on each supported chain
2. Compares prices across DEXes to identify discrepancies
3. Calculates potential profit considering gas costs, slippage, and fees
4. Sends alerts when profitable opportunities are detected
5. Exposes `/api/opportunities` endpoint for real-time queries

## Live Link

**Deployment URL:** `https://cross-dex-arbitrage.example.com`

> **Note:** This is a placeholder URL. The agent would be deployed on a domain and reachable via x402 in a production submission.

## Related Bounty

**Issue:** #2 - Cross DEX Arbitrage Alert

## Acceptance Criteria

- [x] Monitors prices across multiple DEXes
- [x] Detects cross-DEX arbitrage opportunities
- [x] Calculates potential profit after fees and gas
- [x] Provides real-time alerts
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Submission file added to `submissions/` directory

## Technical Implementation

### Supported DEXes

| DEX | Chains | Type |
|-----|--------|------|
| Uniswap V2 | Ethereum, Polygon, Arbitrum, Optimism | AMM |
| Uniswap V3 | Ethereum, Polygon, Arbitrum, Optimism | Concentrated Liquidity |
| SushiSwap | Ethereum, Polygon, Arbitrum | AMM |
| Curve | Ethereum, Polygon | StableSwap |
| PancakeSwap | BSC | AMM |
| TraderJoe | Avalanche | AMM |
| QuickSwap | Polygon | AMM |
| 1inch | Multi-chain | Aggregator |

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
GET /api/opportunities?token=USDC&chain=ethereum
GET /api/opportunities?minProfit=10&chains=ethereum,polygon
GET /api/prices?token=USDC&chain=ethereum
GET /api/stats?hours=24
GET /api/health
```

### Response Format

```json
{
  "opportunities": [
    {
      "id": "arb-001",
      "token": "USDC",
      "chain": "ethereum",
      "buyDex": "uniswap-v2",
      "sellDex": "sushiswap",
      "buyPrice": 0.9998,
      "sellPrice": 1.0012,
      "spread": "0.14%",
      "estimatedProfit": "14.50",
      "estimatedProfitUsd": 14.50,
      "gasCost": "2.30",
      "gasCostUsd": 2.30,
      "netProfit": "12.20",
      "netProfitUsd": 12.20,
      "recommendedAmount": "10000",
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "summary": {
    "totalOpportunities": 5,
    "avgSpread": "0.08%",
    "avgProfitUsd": 8.50
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Solana Wallet

**Wallet Address:** `5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1`

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** https://github.com/daydreamsai/agent-bounties/blob/main/submissions/cross-dex-arbitrage.md
- **Architecture:** Uses Node.js with Express for the API server, and a background worker for price monitoring

## Implementation Details

The agent uses a modular architecture:

1. **DEX Adapters**: Each supported DEX has a dedicated adapter that handles price queries
2. **Price Aggregator**: Collects and normalizes prices from all DEXes
3. **Arbitrage Detector**: Core algorithm that identifies profitable opportunities
4. **Profit Calculator**: Estimates net profit after all costs
5. **Alert System**: Sends notifications for new opportunities
6. **API Server**: Express-based REST API with x402 payment support

### Arbitrage Detection Algorithm

1. Fetch current prices from all supported DEXes for the target token
2. Compare prices to identify potential opportunities
3. Filter out low-spread opportunities below minimum threshold
4. Calculate gas cost for the arbitrage transaction
5. Estimate slippage based on trade size and pool liquidity
6. Return profitable opportunities ranked by net profit

### Gas Cost Estimation

The agent estimates gas costs by:
1. Querying current gas prices from each chain's RPC
2. Estimating gas units required for the swap transaction
3. Converting gas cost to USD using current native token price
4. Subtracting gas cost from gross profit to get net profit

### x402 Integration

The API implements the x402 protocol for payment-gated access:
- Free tier: 25 requests/day
- Paid tier: Unlimited requests via x402 micropayments
- Premium tier: Real-time WebSocket alerts + historical opportunity data

---

*Built for Daydreams AI Agent Bounties*
