# Slippage Sentinel

**Bounty:** [Slippage Sentinel](https://github.com/daydreamsai/agent-bounties/issues/3)

## Agent Description

Slippage Sentinel is an AI agent that estimates safe slippage tolerance for any DeFi swap route to prevent transaction reverts. It analyzes pool depth, recent trade sizes, and volatility to recommend optimal slippage settings.

## Live Deployment

- **URL:** https://slippage-sentinel.vercel.app
- **x402 Endpoint:** https://slippage-sentinel.vercel.app/x402

## How It Works

The agent accepts swap parameters (token_in, token_out, amount_in, route_hint) and returns:

- `min_safe_slip_bps`: Minimum safe slippage in basis points
- `pool_depths`: Liquidity depth data for the route
- `recent_trade_size_p95`: 95th percentile of recent trade sizes

### Algorithm

1. **Pool Depth Analysis**: Fetches liquidity depth from the specified DEX/route
2. **Trade Size Analysis**: Analyzes recent trades to compute the 95th percentile
3. **Volatility Adjustment**: Adjusts slippage based on recent price volatility
4. **Safety Buffer**: Adds a conservative buffer to ensure 95% success rate

## Acceptance Criteria Checklist

- [x] Slippage suggestion prevents revert for 95% of test swaps
- [x] Accounts for pool depth and recent volatility
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YourSolanaWalletAddressHere`

## Additional Resources

- Source code: https://github.com/yourusername/slippage-sentinel
- Demo video: [Link to demo]

## Tech Stack

- `@lucid-dreams/agent-kit` for agent framework
- Node.js / TypeScript
- Deployed on Vercel
- x402 payment protocol integration

---