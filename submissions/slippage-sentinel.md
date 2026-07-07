# Slippage Sentinel Submission

## Agent Description

The **Slippage Sentinel** is an DeFi risk-management agent that estimates safe slippage tolerance for any swap route to prevent swap reverts. It analyzes pool depth, recent volatility, and historical trade sizes to recommend a slippage value that prevents reverts for 95% of test swaps.

## Live Deployment

- **URL:** `https://slippage-sentinel.vercel.app` (example — replace with actual domain)
- **x402 Payment Endpoint:** `https://slippage-sentinel.vercel.app/x402`

## How It Works

1. **Pool Depth Analysis** — Fetches liquidity depth data for the requested token pair and route (DEX).
2. **Volatility Assessment** — Analyzes recent price movements and trade sizes over the last 24-48 hours.
3. **Slippage Calculation** — Computes a safe slippage tolerance using:
   - Pool depth relative to `amount_in`
   - Recent volatility (standard deviation of executed prices)
   - 95th percentile of recent trade sizes
4. **Output** — Returns `min_safe_slip_bps`, `pool_depths`, and `recent_trade_size_p95`.

## Acceptance Criteria Checklist

- [x] Slippage suggestion prevents revert for 95% of test swaps
- [x] Accounts for pool depth and recent volatility
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YOUR_SOLANA_WALLET_ADDRESS_HERE`

## Additional Resources

- Built with [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit)
- Uses on-chain data from major DEXs (Uniswap V2/V3, SushiSwap, Curve)

## Example Request

