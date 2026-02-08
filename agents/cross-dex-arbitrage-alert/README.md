# Cross DEX Arbitrage Alert Agent

> Bounty #2 — Detect cross-DEX token price spreads exceeding threshold

## Overview

This agent monitors price differences across decentralized exchanges (Uniswap V3, SushiSwap V3, Aerodrome) on multiple chains (Base, Ethereum, Arbitrum, Optimism) to identify profitable arbitrage opportunities.

## Entrypoints

### `scan` — Raw Address Scan
Scan for cross-DEX price spreads using token addresses.

```bash
curl -X POST https://your-domain.com/scan \
  -H "Content-Type: application/json" \
  -d '{
    "token_in": "0x4200000000000000000000000000000000000006",
    "token_out": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount_in": "10000000000000000000",
    "chains": [8453],
    "token_out_decimals": 6
  }'
```

### `scan_named` — Symbol-Based Scan
Easier to use — scan using token symbols.

```bash
curl -X POST https://your-domain.com/scan_named \
  -H "Content-Type: application/json" \
  -d '{
    "token_in": "WETH",
    "token_out": "USDC",
    "amount": "10",
    "chains": [8453]
  }'
```

### `triangular_scan` — Triangular Arbitrage
Detect A→B→C→A opportunities on a single chain.

```bash
curl -X POST https://your-domain.com/triangular_scan \
  -H "Content-Type: application/json" \
  -d '{
    "token_a": "WETH",
    "token_b": "USDC",
    "token_c": "cbBTC",
    "amount": "10",
    "chain": 8453
  }'
```

## Response Format

```json
{
  "best_route": {
    "dex": "Uniswap V3 (Base)",
    "chainId": 8453,
    "amountOut": "25032.451200",
    "fee": 500,
    "feeBps": 5,
    "estGasCostUsd": 0.05
  },
  "alt_routes": [...],
  "net_spread_bps": 15,
  "est_fill_cost": "$0.05",
  "profitable": true
}
```

## Supported Chains & DEXes

| Chain | DEXes |
|-------|-------|
| Base (8453) | Uniswap V3, SushiSwap V3, Aerodrome |
| Ethereum (1) | Uniswap V3, SushiSwap V3 |
| Arbitrum (42161) | Uniswap V3, SushiSwap V3 |
| Optimism (10) | Uniswap V3 |

## Setup

```bash
npm install
npm start
```

## Environment Variables

- `BASE_RPC` — Base RPC URL (default: publicnode)
- `ETH_RPC` — Ethereum RPC URL
- `ARB_RPC` — Arbitrum RPC URL
- `OP_RPC` — Optimism RPC URL
- `PORT` — Server port (default: 3000)
