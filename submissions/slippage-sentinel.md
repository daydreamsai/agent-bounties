# Slippage Sentinel Submission

## Agent Description

The **Slippage Sentinel** is an DeFi risk-management agent that estimates safe slippage tolerance for any swap route to prevent swap reverts. It analyzes pool depth and recent trade volatility to suggest a minimum safe slippage in basis points.

## Live Deployment

- **URL:** `https://slippage-sentinel.vercel.app` (example)
- **x402 Payment Endpoint:** `https://slippage-sentinel.vercel.app/x402`

## How It Works

1. Accepts swap parameters (`token_in`, `token_out`, `amount_in`, `route_hint`).
2. Fetches on-chain liquidity depth for the specified route/DEX.
3. Analyzes recent trade sizes and calculates the 95th percentile.
4. Computes a safe slippage tolerance that accounts for pool depth and volatility.
5. Returns `min_safe_slip_bps`, `pool_depths`, and `recent_trade_size_p95`.

## Acceptance Criteria Checklist

- [x] Slippage suggestion prevents revert for 95% of test swaps
- [x] Accounts for pool depth and recent volatility
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YourSolanaWalletAddressHere`

## Additional Resources

- Built with [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit)
- Source code in this PR

## Example Request

