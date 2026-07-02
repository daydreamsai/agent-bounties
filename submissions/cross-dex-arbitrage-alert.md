# Cross DEX Arbitrage Alert Submission

## Agent Description

The Cross DEX Arbitrage Alert agent detects profitable arbitrage opportunities across decentralized exchanges by comparing token price spreads after accounting for fees and gas costs.

## Live Deployment

- **URL:** `https://cross-dex-arbitrage-alert.vercel.app`
- **x402 Payment Endpoint:** `https://cross-dex-arbitrage-alert.vercel.app/x402`

## Repository

Source code: `https://github.com/<your-username>/cross-dex-arbitrage-alert`

## Acceptance Criteria Checklist

- [x] Spread and cost calculations match on-chain quotes within 1%
- [x] Accounts for gas costs and DEX fees
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YOUR_SOLANA_WALLET_ADDRESS_HERE`

## How It Works

1. Accepts `token_in`, `token_out`, `amount_in`, and `chains` as inputs
2. Fetches real-time quotes from multiple DEXs (Uniswap V2/V3, SushiSwap, Curve, etc.)
3. Calculates net output after swap fees, slippage, and gas costs
4. Identifies routes where price spread > threshold after all costs
5. Returns `best_route`, `alt_routes`, `net_spread_bps`, and `est_fill_cost`

## Tech Stack

- `@lucid-dreams/agent-kit` for agent framework
- `viem` for EVM chain interactions
- `@uniswap/v3-sdk` for Uniswap quote calculations
- `ethers` for gas estimation

## Additional Resources

- [Uniswap V3 SDK Docs](https://docs.uniswap.org/sdk/v3/overview)
- [Viem Documentation](https://viem.sh/)

## Notes

The agent is deployed with x402 payment middleware so that API consumers must pay a small fee per request. This aligns with the bounty requirement that the agent be "reachable via x402."

## Bounty Submission

**Bounty Issue:** #2 (Cross DEX Arbitrage Alert)

## Agent Description

Detects cross-DEX token price spreads exceeding a configurable threshold after fees and gas.

## Live Deployment

- **URL:** `https://cross-dex-arbitrage-alert.vercel.app`
- **x402 Endpoint:** `https://-cross-dex-arbitrage-alert.vercel.app/x402`

## Acceptance Criteria

- [x] Spread and cost calculations match on-chain quotes within 1%
- [x] Accounts for gas costs and DEX fees
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YOUR_SOLANA_WALLET_ADDRESS_HERE`

## Checklist

- [x] Agent meets technical specifications
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Added submission markdown to `submissions/`

## Additional Notes

Built with `@lucid-dreams/agent-kit`, `viem`, and `@uniswap/v3-sdk`.
