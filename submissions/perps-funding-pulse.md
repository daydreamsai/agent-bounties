# Perps Funding Pulse

## Overview

Fetches live funding rate, next tick timing, open interest, and long/short skew for perpetual futures markets. Queries Hyperliquid's public API for real-time perps data.

## How It Works

1. **Venue Resolution** — Maps venue identifiers to API endpoints (currently supports Hyperliquid)
2. **Meta + Asset Context Fetch** — Queries the `/info` endpoint with `{"type": "metaAndAssetCtxs"}` to get all perps metadata and live market context in one call
3. **Market Filtering** — Filters results to requested markets (e.g. BTC, ETH) or returns all if none specified
4. **Funding Calculation** — Extracts current funding rate, computes time to next funding tick (Hyperliquid funds hourly), and derives skew from open interest distribution
5. **Response Assembly** — Returns structured per-market funding metrics

## Entrypoints

### `analyze`
Fetch live funding metrics for perpetual markets.

**Input:**
- `venue_ids` — Exchanges to query (e.g. `["hyperliquid"]`)
- `markets` — Markets to track (e.g. `["BTC", "ETH"]`)

**Output:**
- `venue` — Exchange name
- `markets[]` — Per-market metrics:
  - `symbol` — Market symbol
  - `funding_rate` — Current hourly funding rate
  - `time_to_next_s` — Seconds until next funding payment
  - `open_interest` — Total open interest in USD
  - `skew` — Long/short ratio (>1 = more longs)

### `health`
Returns `{ status: "ok", timestamp }`.

## Supported Venues

- **Hyperliquid** — Full support via public REST API (no auth required)

## Tech Stack

- **Runtime:** Node.js / Bun with TypeScript
- **On-chain:** viem available for future on-chain venue support
- **Framework:** @lucid-dreams/agent-kit with x402 payment middleware

## Deployment

```bash
cd submissions/perps-funding-pulse
npm install
ADDRESS=0xYourWallet NETWORK=base-sepolia tsx src/index.ts
```
