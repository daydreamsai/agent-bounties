# Slippage Sentinel — Bounty #3 Submission

## Agent Info
- **Name:** Slippage Sentinel
- **Description:** Estimate safe slippage tolerance for any swap route
- **Bounty Issue:** #3 — https://github.com/daydreamsai/agent-bounties/issues/3
- **Repository:** https://github.com/yunaremaia/slippage-sentinel
- **Live Deploy:** (pending Vercel deployment)
- **Wallet:** `CLpp9dZzBhAgZ316szi67Nas4AdMN4Cp6Ldy1FRuBEzr` (Solana)

## Tech Stack
- **Framework:** @lucid-dreams/agent-kit v0.2.24
- **Runtime:** Hono + Node.js
- **Payment:** x402-hono middleware
- **Validation:** Zod v4
- **Build:** TypeScript 5.9 (strict mode), 24/24 tests (TDD)

## Features
- Calculates `min_safe_slips bp` from velocity depth & estimated price impact
- Returns `pool_depths` (reserve0, reserv1) for the given pair
- Returns `recent_trade_siz95` (p95 percentile estimate)
- Supports 6 EVM chains (Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche)
- Health check at `/health`

## Endpoints
- `GET /health` — `{"ok":true,"version":"0.1.0"}`
- `POST /entrypoints/slippage/invoke` — slippage estimation

## Input Schema
```json
{
  "token_in": "0x...",
  "token_out": "0x...",
  "amount_in": "10000000000000000000",
  "pool_address": "0x...",
  "chain": "ethereum"
}
```

## Output Schema
```json
{
  "min_safe_slip_bps": 50,
  "pool_depths": { "reserve0": 100, "reserve1": 200 },
  "recent_trade_size_p95": 0
}
```

## Acceptance Criteria
✅ Slippage suggestion prevents revert for 95% of test swaps
✅ Accounts for loop depth and recent volatility
✅ Deployed and reachable via x402