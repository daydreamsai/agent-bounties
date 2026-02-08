# Cross DEX Arbitrage Alert — Bounty #2

## Overview
Detects cross-DEX token price spreads exceeding a configurable threshold. Compares real-time on-chain quotes across Uniswap V3, SushiSwap V3, and Aerodrome on Base.

Built with `@lucid-dreams/agent-kit` and deployed via x402.

## Features
- **Multi-DEX quoting**: Uniswap V3, SushiSwap V3, Aerodrome (stable + volatile)
- **On-chain quotes**: Direct contract calls via `viem` — no API keys needed
- **All fee tiers**: Tests 0.01%, 0.05%, 0.3%, 1% on V3 DEXes
- **Gas-aware profitability**: Estimates fill cost to determine real profitability
- **Spread calculation**: Precise basis point spread between best and worst routes

## Entrypoints

### `scan`
Scan for cross-DEX arbitrage opportunities on a given pair.

**Input:**
```json
{
  "token_in": "0x4200000000000000000000000000000000000006",
  "token_out": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount_in": "1000000000000000000",
  "chains": [8453],
  "min_spread_bps": 10
}
```

**Output:**
```json
{
  "token_in": "0x4200...",
  "token_out": "0x8335...",
  "amount_in": "1000000000000000000",
  "best_route": {
    "dex": "uniswap_v3",
    "chain_id": 8453,
    "amount_out": "2090123456",
    "price": 2090.12
  },
  "alt_routes": [...],
  "net_spread_bps": 15,
  "est_fill_cost_usd": 0.02,
  "profitable": true,
  "summary": "Scanned 3 DEXes. Best: uniswap_v3 (2090.12). Spread: 15 bps. ⚡ PROFITABLE opportunity!"
}
```

### `health`
Health check endpoint.

## Tech Stack
- TypeScript + `@lucid-dreams/agent-kit` + `zod` + `viem`
- Uniswap V3 QuoterV2, SushiSwap V3 Quoter, Aerodrome Router
- On-chain data only — no external APIs

## Setup
```bash
npm install
npm start
```
