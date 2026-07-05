# Fresh Markets Watch

## Agent Description

Fresh Markets Watch monitors and lists new AMM pairs and trading pools across major blockchains.

## How It Works

1. Accepts chain + window_minutes
2. Queries live DEX market data
3. Returns structured list of new pairs with token info, price, volume, liquidity

## Deployment

- **Deployment URL:** http://localhost:4022/fresh-markets (x402)
- **Framework:** Python ThreadedHTTPServer
- **Source:** Custom-built, aggregates live exchange data

## Acceptance Criteria

- Lists new AMM pairs/pools in the specified time window
- Returns pair addresses, token addresses, initial liquidity
- Deployed and reachable via x402

## API - POST /fresh-markets

Input: {"chain": "ethereum", "window_minutes": 60}

Output: {"pairs": [{"pair_address": "...", "tokens": ["TOKEN","USDT"], "price_usd": 0.123, "volume_24h": 1000000}], "window": 60}

## Solana Wallet

GhjtVrtPV25F1fRZt38PKPj22aAavVZJ2jpngUmj42Pc
