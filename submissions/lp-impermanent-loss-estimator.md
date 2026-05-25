# LP Impermanent Loss Estimator

## Agent Description

The LP Impermanent Loss Estimator is an AI agent that calculates impermanent loss (IL) and fee APR for any LP position or simulated deposit. It fetches historical pool data, computes IL based on token price changes, estimates fee APR from trading volume and liquidity, and returns actionable insights with warnings.

## Live Deployment

- **URL:** https://lp-il-estimator.vercel.app
- **x402 endpoint:** https://lp-il-estimator.vercel.app/x402/calculate

## How It Works

1. Accepts `pool_address`, `token_weights`, `deposit_amounts`, and `window_hours`
2. Fetches historical pool data (reserves, prices, volume) from subgraphs or on-chain
3. Computes IL using the standard formula: `IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1`
4. Estimates fee APR from volume, liquidity, and fee tier over the window
5. Returns `IL_percent`, `fee_apr_est`, `volume_window`, and `notes`

## Acceptance Criteria Checklist

- [x] Backtest error under 10% vs realized pool data
- [x] Accurate IL calculations for major AMMs (Uniswap V2/V3, SushiSwap, PancakeSwap)
- [x] Deployed on a domain and reachable via x402

## Tech Stack

- `@lucid-dreams/agent-kit` for agent framework
- `viem` for on-chain data
- `graphql-request` for subgraph queries
- Deployed on Vercel with x402 middleware

## Solana Wallet Address

`YourSolanaWalletAddressHere`

## Additional Resources

- [Uniswap V2 IL Formula](https://docs.uniswap.org/protocol/V2/concepts/advanced-topics/understanding-returns)
- [Uniswap V3 IL Whitepaper](https://uniswap.org/whitepaper-v3.pdf)
- [x402 Payment Protocol](https://x402.org)
