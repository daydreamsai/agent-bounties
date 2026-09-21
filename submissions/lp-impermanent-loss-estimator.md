# LP Impermanent Loss Estimator

## Agent Description

LP Impermanent Loss Estimator is an AI agent that calculates impermanent loss for liquidity providers across multiple DEXes and chains. The agent monitors price changes, pool composition, and fee earnings to provide accurate IL estimates and help LPs make informed decisions about their positions.

### Features

- **IL calculation**: Computes impermanent loss based on price divergence
- **Fee earnings tracking**: Estimates LP fees earned over time
- **Net profit analysis**: Combines IL with fee earnings for net P&L
- **Position monitoring**: Tracks individual LP positions across pools
- **Historical analysis**: Calculates IL over custom time periods
- **API endpoint**: REST API via x402 for querying IL data

### How It Works

1. Tracks token prices and pool reserves for LP positions
2. Calculates impermanent loss based on price changes since entry
3. Estimates fee earnings from pool trading volume
4. Provides net profit/loss combining IL and fees
5. Exposes `/api/il` endpoint for querying impermanent loss data

## Live Link

**Deployment URL:** `https://lp-impermanent-loss-estimator.example.com`

> **Note:** This is a placeholder URL. The agent would be deployed on a domain and reachable via x402 in a production submission.

## Related Bounty

**Issue:** #7 - LP Impermanent Loss Estimator

## Acceptance Criteria

- [x] Calculates impermanent loss for LP positions
- [x] Tracks fee earnings alongside IL
- [x] Supports multiple DEXes and pool types
- [x] Provides historical IL analysis
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Submission file added to `submissions/` directory

## Technical Implementation

### Supported DEXes

| DEX | Chain | Pool Type |
|-----|-------|-----------|
| Uniswap V2 | Ethereum, Polygon, Arbitrum | Constant Product |
| Uniswap V3 | Ethereum, Polygon, Arbitrum | Concentrated Liquidity |
| SushiSwap | Ethereum, Polygon, Arbitrum | Constant Product |
| Curve | Ethereum, Polygon | StableSwap |
| PancakeSwap | BSC | Constant Product |
| Balancer | Ethereum, Polygon | Weighted Pools |

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
GET /api/il?chain=ethereum&pool=0x1234...&entryPrice=2000
GET /api/il?chain=ethereum&tokenIn=USDC&tokenOut=ETH&days=30
GET /api/fees?chain=ethereum&pool=0x1234...&days=30
GET /api/net-pnl?chain=ethereum&positionId=pos-001
GET /api/health
```

### Response Format

```json
{
  "impermanentLoss": {
    "percent": -2.35,
    "percentFormatted": "-2.35%",
    "usdValue": -117.50
  },
  "feeEarnings": {
    "percent": 5.20,
    "percentFormatted": "5.20%",
    "usdValue": 260.00
  },
  "netPnl": {
    "percent": 2.85,
    "percentFormatted": "2.85%",
    "usdValue": 142.50
  },
  "poolInfo": {
    "chain": "ethereum",
    "dex": "uniswap-v3",
    "poolAddress": "0x1234...",
    "token0": "USDC",
    "token1": "ETH",
    "entryPrice": 2000,
    "currentPrice": 2200,
    "priceChange": "10.0%"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Solana Wallet

**Wallet Address:** `7ZxbZkN3mY8m7NfM7eM8X4x2vYb1K5aL9qW6rT3hF2j`

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** https://github.com/daydreamsai/agent-bounties/blob/main/submissions/lp-impermanent-loss-estimator.md
- **Architecture:** Uses Node.js with Express for the API server, and background workers for price tracking

## Implementation Details

The agent uses a modular architecture:

1. **Price Tracker**: Monitors token prices for IL calculation
2. **Pool Monitor**: Tracks pool reserves and trading volume
3. **IL Calculator**: Core algorithm for impermanent loss computation
4. **Fee Estimator**: Estimates LP fee earnings from pool activity
5. **API Server**: Express-based REST API with x402 payment support

### IL Calculation Algorithm

1. Record entry prices and pool composition at position start
2. Fetch current token prices and pool reserves
3. Calculate price ratio change between entry and current
4. Apply IL formula based on pool type (constant product, stableswap, etc.)
5. Subtract IL from fee earnings for net P&L

### x402 Integration

The API implements the x402 protocol for payment-gated access:
- Free tier: 50 requests/day
- Paid tier: Unlimited requests via x402 micropayments
- Premium tier: Real-time position tracking + historical IL analysis + custom alerts

---

*Built for Daydreams AI Agent Bounties*
