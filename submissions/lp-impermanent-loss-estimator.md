# LP Impermanent Loss Estimator

## Agent Description

An AI agent that calculates impermanent loss (IL) and fee APR for any LP position or simulated deposit across major AMMs (Uniswap V2/V3, SushiSwap, PancakeSwap, Curve).

## Live Deployment

- **URL**: https://lp-il-estimator.vercel.app
- **x402 Endpoint**: `https://lp-il-estimator.vercel.app/x402/calculate`

## How It Works

The agent accepts a pool address, token weights, deposit amounts, and a historical window, then:

1. Fetches on-chain pool data (reserves, fees, volume) via subgraphs (The Graph, Covalent, or direct RPC).
2. Computes impermanent loss using the standard formula:
   - `IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1`
3. Estimates fee APR from historical trading volume, pool fee tier, and LP share of the pool.
4. Validates results against realized pool data with <10% backtest error.

## Acceptance Criteria Checklist

- [x] Backtest error under 10% vs realized pool data
- [x] Accurate IL calculations for major AMMs
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YourSolanaWalletAddressHere`

## Additional Resources

- Uses `@lucid-dreams/agent-kit` for agent scaffolding
- Integrates with Uniswap V3 subgraph for historical data
- Supports Ethereum, Polygon, Arbitrum, and BSC pools

## Example Request

