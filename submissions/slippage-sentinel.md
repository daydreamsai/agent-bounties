# Slippage Sentinel Submission

## Agent Description

The Slippage Sentinel is an DeFi risk management agent that estimates safe slippage tolerance for any swap route to prevent swap reverts. It analyzes pool depth, recent trade sizes, and volatility to recommend a slippage value that prevents reverts for 95% of test swaps.

## Live Deployment

- **URL:** `https://slippage-sentinel.vercel.app`
- **x402 Endpoint:** `https://slippage-sentinel.vercel.app/x402`

## How It Works

The agent accepts swap parameters (`token_in`, `token_out`, `amount_in`, `route_hint`) and returns:

- `min_safe_slip_bps`: Minimum safe slippage in basis points
- `pool_depths`: Liquidity depth data for the route
- `recent_trade_size_p95`: 95th percentile of recent trade sizes

### Methodology

1. **Pool Depth Analysis**: Fetches liquidity depth from the suggested DEX/route to understand how much liquidity is available at various price levels.
2. **Recent Trade Size Analysis**: Analyzes recent trades on the route to compute the 95th percentile trade size, which serves as a benchmark for "normal" trade volume.
3. **Volatility Adjustment**: Adjusts slippage based on recent price volatility in the pool.
4. **Safe Slippage Calculation**: Combines these factors to compute a slippage tolerance that prevents reverts for 95% of historical swaps.

### Slippage Formula

