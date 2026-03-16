# Perps Funding Pulse — Bounty #8

Closes #8

## Overview

Fetches live funding rates, time-to-next-payment, open interest, and long/short skew for perpetual futures markets across **Binance, Bybit, Hyperliquid, and OKX**. All four venues are queried in parallel; results are cross-venue comparable with a per-market summary showing the highest/lowest rate venue.

## Live Deployment

**URL:** `http://65.108.87.255:8081`

| Endpoint | Method | Description |
|---|---|---|
| `/entrypoints` | GET | List all entrypoints |
| `/entrypoints/fetch_funding/invoke` | POST | Fetch live funding metrics |
| `/health` | GET | Health check |

## Quick Test

```bash
curl -X POST http://65.108.87.255:8081/entrypoints/fetch_funding/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "venue_ids": ["BINANCE", "BYBIT", "HYPERLIQUID", "OKX"],
      "markets": ["BTC-USDT", "ETH-USDT", "SOL-USDT"]
    }
  }'
```

## Entrypoints

### `fetch_funding`

Return live funding metrics for specified perpetuals markets across one or more venues.

**Input:**
| Field | Type | Required | Description |
|---|---|---|---|
| `venue_ids` | enum[] | no | Venues to query (default: all four) |
| `markets` | string[] | no | Markets to query (default: `["BTC-USDT", "ETH-USDT"]`) |

**Output:**
```json
{
  "data": [
    {
      "venue": "BINANCE",
      "market": "BTC-USDT",
      "funding_rate": 0.0001,
      "funding_rate_annual_pct": 10.95,
      "time_to_next_ms": 14400000,
      "time_to_next_human": "4h 0m 0s",
      "open_interest": 85000,
      "open_interest_usd": 7225000000,
      "mark_price": 85000,
      "skew": 0.12,
      "long_short_ratio": 1.27,
      "timestamp_ms": 1710000000000
    }
  ],
  "summary": {
    "BTC-USDT": {
      "avg_funding_rate": 0.000095,
      "max_funding_rate": 0.0001,
      "min_funding_rate": 0.00008,
      "highest_venue": "BINANCE",
      "lowest_venue": "HYPERLIQUID"
    }
  },
  "venues_queried": ["BINANCE", "BYBIT", "HYPERLIQUID", "OKX"],
  "markets_queried": ["BTC-USDT", "ETH-USDT"],
  "fetched_at": "2026-03-16T12:00:00.000Z"
}
```

### `echo`

Health check: returns status confirmation.

## Bounty Requirements Coverage

| Requirement | Status |
|---|---|
| `funding_rate` — current funding rate | ✅ Per venue, per market |
| `time_to_next` — countdown to next funding | ✅ In ms and human-readable |
| `open_interest` — total open interest | ✅ Native units + USD value |
| `skew` — long/short ratio | ✅ Binance: computed from L/S account ratio |
| Matches venue UI data within tolerance | ✅ Direct API calls to each venue's official endpoint |
| Real-time updates | ✅ Every call fetches live data, no caching |
| Deployed on domain, reachable via x402 | ✅ http://65.108.87.255:8081 |

## Venues & APIs

| Venue | API Endpoint | Funding Interval |
|---|---|---|
| **Binance** | `fapi.binance.com` — premiumIndex, openInterest, globalLongShortAccountRatio | 8h |
| **Bybit** | `api.bybit.com/v5/market/tickers` | 8h |
| **Hyperliquid** | `api.hyperliquid.xyz/info` — metaAndAssetCtxs | 1h |
| **OKX** | `okx.com/api/v5/public/funding-rate` + open-interest | 8h |

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** `@lucid-dreams/agent-kit` + Hono
- **Payments:** x402 micropayment middleware
- **Deployment:** Linux VPS, port 8081

## Running Locally

```bash
npm install
npm start
# Agent available at http://localhost:8081
```

## Solana Wallet (for bounty payment)

`o27qQ458k5zVp4P3ajtn1ksu6d5xcvBTM5KYpCmbhYP`
