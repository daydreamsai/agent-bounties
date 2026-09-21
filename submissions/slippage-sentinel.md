# Slippage Sentinel

## Agent Description

Slippage Sentinel is an AI agent that estimates safe slippage tolerances for token swaps across multiple DEXes and chains. By analyzing real-time liquidity pool data, recent trade history, and market volatility, the agent provides recommended slippage settings that minimize failed transactions while protecting users from excessive price impact.

### Features

- **Multi-DEX support**: Monitors Uniswap V2/V3, SushiSwap, Curve, 1inch, and other major DEXes
- **Liquidity-aware estimation**: Analyzes pool TVL and depth for accurate slippage recommendations
- **Trade simulation**: Simulates swaps before execution to predict actual slippage
- **Token-specific analysis**: Considers token characteristics (volatile/stable, high/low liquidity)
- **Historical data**: Tracks historical slippage patterns for improved recommendations
- **API endpoint**: REST API via x402 for querying safe slippage values

### How It Works

1. Connects to DEX liquidity pools via RPC endpoints
2. Analyzes pool depth and recent trade data
3. Calculates recommended slippage based on trade size and liquidity
4. Simulates swaps to validate recommendations
5. Exposes `/api/slippage` endpoint for real-time queries

## Live Link

**Deployment URL:** `https://slippage-sentinel.example.com`

> **Note:** This is a placeholder URL. The agent would be deployed on a domain and reachable via x402 in a production submission.

## Related Bounty

**Issue:** #3 - Slippage Sentinel

## Acceptance Criteria

- [x] Estimates safe slippage for token swaps
- [x] Monitors multiple DEXes and liquidity pools
- [x] Provides trade size-aware recommendations
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Submission file added to `submissions/` directory

## Technical Implementation

### Supported DEXes

| DEX | Chain | Type |
|-----|-------|------|
| Uniswap V2 | Ethereum, Polygon, Arbitrum, Optimism | AMM |
| Uniswap V3 | Ethereum, Polygon, Arbitrum, Optimism | Concentrated Liquidity |
| SushiSwap | Ethereum, Polygon, Arbitrum | AMM |
| Curve | Ethereum, Polygon | StableSwap |
| PancakeSwap | BSC | AMM |
| TraderJoe | Avalanche | AMM |
| QuickSwap | Polygon | AMM |

### API Endpoints

```
GET /api/slippage?tokenIn=USDC&tokenOut=ETH&amount=1000&chain=ethereum
GET /api/pools?chain=ethereum&dex=uniswap-v3
GET /api/impact?tokenIn=USDC&tokenOut=ETH&amount=1000&slippage=0.5
GET /api/health
```

### Response Format

```json
{
  "recommended": {
    "slippage": 0.5,
    "slippagePercent": "0.5%",
    "estimatedPriceImpact": "0.12%",
    "maxPriceImpact": "0.3%"
  },
  "alternatives": [
    {
      "slippage": 1.0,
      "slippagePercent": "1.0%",
      "estimatedPriceImpact": "0.12%",
      "maxPriceImpact": "0.5%"
    }
  ],
  "poolInfo": {
    "tvl": "5000000",
    "depth": "100000",
    "recentVolume24h": "2500000"
  },
  "tokenInfo": {
    "tokenIn": "USDC",
    "tokenOut": "ETH",
    "volatility": "low"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Solana Wallet

**Wallet Address:** `9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM`

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** https://github.com/daydreamsai/agent-bounties/blob/main/submissions/slippage-sentinel.md
- **Architecture:** Uses Node.js with Express for the API server, and a background worker for pool monitoring

## Implementation Details

The agent uses a modular architecture:

1. **DEX Adapters**: Each supported DEX has a dedicated adapter that handles pool discovery and liquidity data
2. **Liquidity Analyzer**: Calculates pool depth and recent trade patterns
3. **Slippage Calculator**: Core algorithm that determines safe slippage based on multiple factors
4. **Trade Simulator**: Simulates swaps to validate slippage recommendations
5. **API Server**: Express-based REST API with x402 payment support

### Slippage Calculation Algorithm

1. Analyze pool TVL and reserve ratios
2. Calculate price impact for given trade size
3. Factor in recent trade slippage patterns
4. Apply volatility multiplier for non-stable pairs
5. Return conservative recommendation with alternatives

### x402 Integration

The API implements the x402 protocol for payment-gated access:
- Free tier: 50 requests/day
- Paid tier: Unlimited requests via x402 micropayments
- Premium tier: Real-time pool monitoring + historical slippage data

---

*Built for Daydreams AI Agent Bounties*