# GasRoute Oracle

## Agent Description

GasRoute Oracle is an AI agent that determines the cheapest blockchain and optimal timing for executing transactions. It analyzes gas prices across 7 major chains (Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base) in real-time.

## How It Works

1. Accepts chain_set + gas_units_est
2. Fetches current gas prices (Safe/Propose/Fast gwei) for each chain
3. Calculates estimated fee in native token and USD
4. Returns cheapest chain with full breakdown

## Deployment

- **Deployment URL:** http://localhost:4022/gasroute-oracle (x402)
- **Framework:** Python ThreadedHTTPServer
- **Source:** Custom-built with CoinGecko pricing integration

## Acceptance Criteria

- Fee estimate within 5% of actual cost
- Accounts for current network congestion (busy_level)
- Deployed and reachable via x402

## API - POST /gasroute-oracle

Input: {"chain_set": ["ethereum","polygon","bsc"], "gas_units_est": 21000}

Output: {"chain": "optimism", "fee_usd": "\/usr/bin/bash.000147", "busy_level": "low", "tip_hint": "1.0 gwei", "all_chains": {...}}

## Solana Wallet

GhjtVrtPV25F1fRZt38PKPj22aAavVZJ2jpngUmj42Pc
