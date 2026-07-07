# Slippage Sentinel Submission

## Agent Description

The **Slippage Sentinel** is an DeFi risk-management agent that estimates safe slippage tolerance for any swap route to prevent swap reverts. It analyzes pool depth, recent volatility, and trade size distribution to recommend a slippage value that prevents reverts in 95% of cases.

## Live Deployment

- **URL:** `https://slippage-sentinel.vercel.app` (example — replace with actual deployment)
- **x402 Payment Endpoint:** `https://slippage-sentinel.vercel.app/x402`

## How It Works

1. **Pool Depth Analysis** — Fetches liquidity depth for the requested token pair and route (DEX).
2. **Recent Trade Analysis** — Analyzes the last N trades to compute the 95th percentile trade size (`recent_trade_size_p95`).
3. **Volatility Adjustment** — Computes price volatility from recent trades to adjust slippage upward during turbulent periods.
4. **Safe Slippage Calculation** — Combines depth, volatility, and trade size into a `min_safe_slip_bps` value.

## API / Entrypoints

### `estimateSlippage`

**Input:**
