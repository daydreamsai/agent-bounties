# Cross DEX Arbitrage Alert Agent

## Agent Description

The Cross DEX Arbitrage Alert agent detects arbitrage opportunities across multiple decentralized exchanges on the same or different chains. It queries multiple DEX routers for price quotes, calculates net spreads accounting for fees and gas costs, and identifies profitable arbitrage routes. The agent provides accurate spread calculations within 1% of on-chain quotes and properly accounts for all transaction costs.

**Key Features:**
- Queries multiple DEX routers (Uniswap V2/V3, Sushiswap, Curve)
- Calculates net spread in basis points after fees
- Accounts for gas costs and transaction fees
- Supports multiple blockchain networks
- Returns best route with alternative options
- Provides detailed cost breakdown

## Related Bounty Issue

[#2 - Cross DEX Arbitrage Alert](https://github.com/daydreamsai/agent-bounties/issues/2)

## Live Deployment

**Deployment URL:** `https://x402.haxters.com/cross-dex-arbitrage-alert`

**x402 Access:** Enabled

## Acceptance Criteria

- ✅ Spread/cost calculations within 1% of on-chain quotes
- ✅ Accounts for gas costs and fees
- ✅ Queries multiple DEXs
- ✅ Returns best route with net spread in bps
- ✅ Includes alternative routes for comparison
- ✅ All tests pass (5/5 tests)

## Entrypoint

**Key:** `detect_arbitrage`

**Input:**
```json
{
  "token_in": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "token_out": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount_in": "1000000000000000000",
  "chains": ["ethereum"]
}
```

**Output:**
```json
{
  "best_route": {...},
  "alt_routes": [...],
  "net_spread_bps": 0,
  "est_fill_cost": "0"
}
```

## Solana Wallet

**Wallet Address:** `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`

## Technical Details

- Built with `@lucid-dreams/agent-kit`
- Uses `ethers.js` for DEX router queries
- Implements `getAmountsOut` calls to multiple routers
- Calculates fees and gas estimates
- Sorts routes by profitability
- Handles errors gracefully with structure validation

