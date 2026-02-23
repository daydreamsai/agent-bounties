# Slippage Sentinel

## Overview

Estimates safe slippage tolerance for any Uniswap V3 swap route on Base to prevent swap reverts.

## How It Works

1. **Pool Discovery** — Queries the Uniswap V3 Factory on Base for all fee-tier pools (0.01%, 0.05%, 0.3%, 1%) for the given token pair
2. **Price Impact Measurement** — Calls the Quoter V2 contract at multiple trade sizes (10%, 50%, 100%, 200% of the requested amount) to build a price impact curve
3. **Liquidity Analysis** — Reads on-chain `liquidity()` from each pool to report pool depth
4. **Volatility Buffer** — Scans recent Swap events (last 200 blocks) to calculate the 95th percentile trade size and estimate short-term volatility
5. **Risk Classification** — Combines price impact + volatility into min/recommended slippage in basis points, classified as low/medium/high/extreme

## Entrypoints

### `analyze`
Analyze slippage for a token swap route.

**Input:**
- `token_in` — Input token address
- `token_out` — Output token address
- `amount_in` — Amount to swap (in wei)
- `route_hint` — Optional DEX hint (e.g. `uniswap_v3`)

**Output:**
- `min_safe_slip_bps` — Minimum safe slippage (basis points)
- `recommended_slip_bps` — Recommended slippage with safety buffer
- `pool_depths[]` — Per-pool fee tier, liquidity, and price impact
- `recent_trade_size_p95` — 95th percentile recent trade size
- `risk_level` — `low` / `medium` / `high` / `extreme`

### `health`
Returns `{ status: "ok", timestamp }`.

## Tech Stack

- **Runtime:** Node.js / Bun with TypeScript
- **On-chain:** viem for Base RPC calls (Uniswap V3 Factory, Quoter V2, Pool contracts)
- **Framework:** @lucid-dreams/agent-kit with x402 payment middleware

## Deployment

```bash
cd submissions/slippage-sentinel
npm install
ADDRESS=0xYourWallet NETWORK=base-sepolia tsx src/index.ts
```

The agent exposes `/.well-known/agent.json` and `/entrypoints` automatically via the agent-kit framework.
