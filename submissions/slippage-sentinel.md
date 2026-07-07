# Slippage Sentinel

## Agent Description

Slippage Sentinel is an AI agent that estimates safe slippage tolerance for any swap route to prevent swap reverts. It analyzes pool depth, recent trade sizes, and volatility to recommend a minimum safe slippage in basis points.

## Live Deployment

- **URL**: https://slippage-sentinel.vercel.app
- **x402 Payment**: Enabled at `https://slippage-sentinel.vercel.app/x402`

## How It Works

The agent accepts swap parameters (`token_in`, `token_out`, `amount_in`, `route_hint`) and returns:

- `min_safe_slip_bps`: Minimum safe slippage in basis points
- `pool_depths`: Liquidity depth data for the route
- `recent_trade_size_p95`: 95th percentile of recent trade sizes on the route

### Methodology

1. **Pool Depth Analysis**: Fetches on-chain liquidity depth for the specified route/DEX.
2. **Recent Trade Analysis**: Collects recent trade sizes data and computes the 95th percentile.
3. **Volatility Adjustment**: Adjusts slippage based on recent price volatility.
4. **Safety Margin**: Adds a buffer to ensure 95% of test swaps would not revert.

## Acceptance Criteria Checklist

- [x] Slippage suggestion prevents revert for 95% of test swaps
- [x] Accounts for pool depth and recent volatility
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YourSolanaWalletAddressHere`

## Additional Resources

- Source code: [GitHub Repo](https://github.com/yourusername/slippage-sentinel)
- Built with: [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit)

## Example Request

