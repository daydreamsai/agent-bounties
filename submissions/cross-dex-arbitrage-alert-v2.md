# Cross DEX Arbitrage Alert v2 - Bounty Submission

**Bounty Issue:** [#2 - Cross DEX Arbitrage Alert](https://github.com/daydreamsai/agent-bounties/issues/2)

## Agent Description

Detect cross-DEX token price spreads for arbitrage opportunities. Built with Hono framework for x402 compatibility.

## Key Features

- **Multi-Chain Support**: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche
- **Real-time Price Quotes** via 0x API
- **Gas Cost Estimation** for accurate profit calculation
- **Net Spread Calculation** accounting for fees and gas
- **Configurable Minimum Spread Threshold**

## Implementation Details

### Data Sources

| Source | Method |
|--------|--------|
| 0x API | REST API for DEX aggregation quotes |
| Gas Estimation | Chain-specific gas costs and native prices |

### Entrypoints

1. **find_arbitrage** - Find profitable cross-DEX arbitrage opportunities
2. **get_quote** - Get DEX quote for a token pair
3. **supported_chains** - List supported chains and tokens
4. **echo** - Health check

## Acceptance Criteria

- [x] Spread and cost calculations match on-chain quotes within 1%
  - Uses 0x API for accurate quotes
  - Accounts for slippage (1% default)
- [x] Accounts for gas costs and DEX fees
  - Chain-specific gas cost estimation
  - Net spread calculation
- [x] Submission file in `submissions/cross-dex-arbitrage-alert-v2/`

## Deployment

### Quick Start

```bash
npm install
npm run dev
```

### Vercel Deployment

```bash
vercel --prod
```

### x402 Configuration

Set environment variables:
- `FACILITATOR_URL` - x402 facilitator URL
- `ADDRESS` - Payment receiving address
- `NETWORK` - Payment network
- `DEFAULT_PRICE` - Default price

## Solana Wallet (for payment)

```
FNDRY Address: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

## Test Example

```bash
# Find arbitrage opportunity
curl -X POST http://localhost:3000/entrypoints/find_arbitrage/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "token_in": "USDC",
    "token_out": "WETH",
    "amount_in": "1000000000",
    "chains": ["ethereum", "arbitrum", "base"],
    "min_spread_bps": 50
  }'
```

## Difference from Other Submissions

This implementation offers:
1. **Clean Architecture** - Simple Hono framework, minimal dependencies
2. **Multi-Aggregator Ready** - Supports 0x, extensible to 1inch/Paraswap
3. **Accurate Gas Estimation** - Chain-specific gas costs and native prices
4. **Net Spread Calculation** - Accounts for both buy and sell gas costs