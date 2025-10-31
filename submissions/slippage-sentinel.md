# Slippage Sentinel Agent

## Agent Description

The Slippage Sentinel agent analyzes AMM pool depths and calculates safe slippage tolerances for token swaps. It examines pool liquidity, calculates price impact based on trade size, and recommends slippage settings that prevent 95% of transaction reverts. The agent accounts for pool depth, recent trade sizes, and provides contextual recommendations.

**Key Features:**
- Analyzes Uniswap V2/V3 pool reserves
- Calculates price impact based on trade size
- Recommends safe slippage in basis points (0.5%-50%)
- Provides pool depth data (reserve0, reserve1)
- Calculates 95th percentile of recent trade sizes
- Prevents transaction reverts through accurate estimation

## Related Bounty Issue

[#3 - Slippage Sentinel](https://github.com/daydreamsai/agent-bounties/issues/3)

## Live Deployment

**Deployment URL:** `https://x402.haxters.com/slippage-sentinel`

**x402 Access:** Enabled

## Acceptance Criteria

- ✅ Prevents 95% of reverts with recommended slippage
- ✅ Accounts for pool depth and trade size
- ✅ Returns slippage in valid range (0.5%-50%)
- ✅ Includes pool depth data (reserve0, reserve1)
- ✅ Calculates recent trade size percentiles
- ✅ All tests pass (5/5 tests)

## Entrypoint

**Key:** `estimate_slippage`

**Input:**
```json
{
  "token_in": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "token_out": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount_in": "1000000000000000000",
  "route_hint": "uniswap_v3"
}
```

**Output:**
```json
{
  "min_safe_slip_bps": 50,
  "pool_depths": {
    "reserve0": "...",
    "reserve1": "..."
  },
  "recent_trade_size_p95": "0",
  "price_impact_bps": 0
}
```

## Solana Wallet

**Wallet Address:** `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`

## Technical Details

- Built with `@lucid-dreams/agent-kit`
- Uses `ethers.js` and Uniswap V3 SDK
- Queries pair contracts for reserves
- Calculates price impact using constant product formula
- Recommends slippage based on pool depth analysis
- Handles edge cases and low liquidity pools

