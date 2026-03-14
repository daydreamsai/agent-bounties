# Perps Funding Pulse — Bounty #8

Closes #8

## Overview

Fetches live funding rates, time-to-next-payment, open interest, and long/short skew for perpetual futures markets across **Binance, Bybit, Hyperliquid, and OKX**.

## Agent

Built with `@lucid-dreams/agent-kit` + `zod` + `@hono/node-server`.

**Deployed:** `http://65.108.87.255:8081`

## Entrypoints

### `fetch_funding`

Fetches live funding data for specified markets across specified venues.

**Input:**
- `venue_ids` — `["BINANCE", "BYBIT", "HYPERLIQUID", "OKX"]`
- `markets` — e.g. `["BTC-USDT", "ETH-USDT", "SOL-USDT"]`

**Output:**
- `data[]` — per-venue per-market records with:
  - `funding_rate` — current funding rate
  - `funding_rate_annual_pct` — annualized %
  - `time_to_next_ms` + `time_to_next_human` — countdown to next payment
  - `open_interest` + `open_interest_usd`
  - `mark_price`
  - `skew` + `long_short_ratio` (where available)
- `summary` — per-market cross-venue comparison (highest/lowest venue by rate)

### `echo`

Health check.

## Running

```bash
npm install
npm start
```
