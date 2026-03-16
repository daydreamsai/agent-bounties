# Fresh Markets Watch

Monitor new AMM pairs and pools across decentralized exchanges. Detects newly created liquidity pools in real-time using public DEX APIs.

## Description

Fresh Markets Watch scans DEX aggregators and on-chain data to surface newly created AMM pairs within minutes of deployment. Useful for traders seeking early access to new token pairs and liquidity providers looking for high-yield opportunities.

## Entrypoints

- `GET /pairs/new` — List recently created AMM pairs
- `GET /pairs/new?chain=<chain>` — Filter by chain (solana, ethereum, base, etc.)
- `GET /pairs/new?dex=<dex>` — Filter by specific DEX
- `GET /health` — Health check endpoint

## Acceptance Criteria

- ✅ Lists new AMM pairs within 5 minutes of pool creation
- ✅ Supports at least 3 chains (Solana, Ethereum, Base)
- ✅ Returns pair address, token symbols, creation time, initial liquidity
- ✅ Exposed via x402 payment protocol
- ✅ Deployed on a public domain

## Tech Stack

- TypeScript + `@lucid-dreams/agent-kit`
- Public DEX APIs (Jupiter, Raydium, Uniswap subgraphs)
