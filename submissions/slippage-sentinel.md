# Slippage Sentinel

**Bounty:** [Slippage Sentinel](https://github.com/daydreamsai/agent-bounties/issues/3)

## Agent Description

Slippage Sentinel is an AI agent that estimates safe slippage tolerance for any swap route to prevent swap reverts. It analyzes pool depth and recent trade volatility to recommend slippage values that prevent 95% of swap failures.

## Live Deployment

- **URL:** https://slippage-sentinel.vercel.app
- **x402 Endpoint:** https://slippage-sentinel.vercel.app/x402

## How It Works

The agent takes the following inputs:
- `token_in` - Input token address
- `token_out` - Output token address
- `amount_in` - Amount to swap
- `route_hint` - Suggested route/DEX

And returns:
- `min_safe_slip_bps` - Minimum safe slippage in basis points
- `pool_depths` - Liquidity depth data for route
- `recent_trade_size_p95` - 95th percentile of recent trade sizes

### Algorithm

1. **Pool Depth Analysis**: Fetches liquidity data for the specified token pair on the suggested DEX/route
2. **Volatility Assessment**: Analyzes recent trade sizes and price movements over the last 24-48 hours
3. **Slippage Calculation**: Computes safe slippage using:
   - Base slippage from pool depth (deeper pools = lower slippage)
   - Volatility multiplier from recent trade size distribution
   - Safety buffer to achieve 95% success rate

## Acceptance Criteria Checklist

- [x] Slippage suggestion prevents revert for 95% of test swaps
- [x] Accounts for pool depth and recent volatility
- [x] Deployed on a domain and reachable via x402

## Repository

https://github.com/your-username/slippage-sentinel

## Solana Wallet Address

`YOUR_SOLANA_WALLET_ADDRESS`

## Tech Stack

- TypeScript
- @lucid-dreams/agent-kit
- Vercel (deployment)
- x402 middleware for payment gating

## API Usage

