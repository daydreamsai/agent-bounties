# Slippage Sentinel - Submission

## Agent Description

Slippage Sentinel is an AI agent that estimates safe slippage tolerance for any swap route to prevent swap reverts. It analyzes pool depth, recent trade sizes, and volatility to recommend a minimum safe slippage in basis points that will prevent reverts for 95% of swaps.

## Live Deployment

**Domain:** https://slippage-sentinel.vercel.app

**x402 Endpoint:** https://slippage-sentinel.vercel.app/api/x402

## Acceptance Criteria

- [x] Slippage suggestion prevents revert for 95% of test swaps
- [x] Accounts for pool depth and recent volatility
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`[YOUR_SOLANA_WALLET_ADDRESS_HERE]`

## Implementation Details

### Architecture

The agent is built using `@lucid-dreams/agent-kit` and deployed as a serverless function. It:

1. Accepts swap parameters (token_in, token_out, amount_in, route_hint)
2. Fetches on-chain pool data for the specified route
3. Analyzes recent trade sizes to compute the 95th percentile
4. Calculates pool depth and liquidity distribution
5. Estimates safe slippage based on price impact models
6. Returns min_safe_slip_bps, pool_depths, and recent_trade_size_p95

### Slippage Calculation Model

The safe slippage is calculated using:

- **Constant Product AMM Model:** For Uniswap V2 style pools, price impact = amount_in / (reserve + amount_in)
- **Concentrated Liquidity Model:** For Uniswap V3 style pools, uses tick-based liquidity distribution
- **Volatility Adjustment:** Multiplies base slippage by a volatility factor derived from recent trade size variance
- **Safety Margin:** Adds a 20% buffer to ensure 95% confidence

### Pool Depth Analysis

The agent queries the pool's reserves or liquidity distribution to determine:
- Total liquidity available at current price
- Liquidity depth within ±2% of current price
- Maximum trade size before 1% price impact

### Recent Trade Analysis

Uses historical swap events to compute:
- 95th percentile of recent trade sizes
- Trade frequency and size distribution
- Volatility indicator based on trade size variance

## Source Code

