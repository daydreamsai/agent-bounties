# Slippage Sentinel Submission

## Agent Description

The **Slippage Sentinel** is an DeFi risk-management agent that estimates safe slippage tolerance for any swap route to prevent swap reverts. It analyzes pool depth, recent trade sizes, and volatility to recommend a minimum safe slippage value in basis points (bps).

## Live Deployment

- **URL:** `https://slippage-sentinel.vercel.app` (example — replace with actual domain)
- **x402 Payment Gateway:** Enabled at `https://slippage-sentinel.vercel.app/x402`

## How It Works

1. **Pool Depth Analysis** — Fetches liquidity depth for the requested token pair and route (DEX).
2. **Recent Trade Size Percentile** — Computes the 95th percentile of recent trade sizes on the route.
3. **Volatility Adjustment** — Adjusts slippage based on recent price volatility.
4. **Safe Slippage Recommendation** — Returns `min_safe_slip_bps` that prevents reverts for ~95% of similar swaps.

## API / Entrypoint

### `estimateSlippage`

**Input:**
