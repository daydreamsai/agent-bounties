# Slippage Sentinel

**Bounty:** [Slippage Sentinel](https://github.com/daydreamsai/agent-bounties/issues/3)

## Agent Description

Slippage Sentinel is an AI agent that estimates safe slippage tolerance for any swap route to prevent swap reverts. It analyzes pool depth, recent volatility, and trade size distribution to recommend slippage values that prevent 95% of swap failures.

## Live Deployment

- **URL:** https://slippage-sentinel.vercel.app
- **x402 Endpoint:** https://slippage-sentinel.vercel.app/x402

## How It Works

The agent accepts swap parameters (token_in, token_out, amount_in, route_hint) and returns:

- `min_safe_slip_bps`: Minimum safe slippage in basis points
- `pool_depths`: Liquidity depth data for the route
- `recent_trade_size_p95`: 95th percentile of recent trade sizes

### Algorithm

1. **Pool Depth Analysis**: Fetches liquidity depth for the specified route/DEX
2. **Volatility Assessment**: Analyzes recent price movements and trade sizes
3. **Slippage Calculation**: Computes safe slippage using:
   - Base slippage from pool depth (deeper = lower slippage)
   - Volatility multiplier from recent price swings
   - Trade size impact (larger trades need more slippage)
   - 95th percentile safety buffer

### Formula

