# Perps Funding Pulse

**Bounty:** [Daydreams Agent Bounties #8](https://github.com/daydreamsai/agent-bounties/issues/8)

## Purpose

Fetches real-time perpetuals funding rates, open interest, time to next funding, and long/short skew from Hyperliquid, dYdX v4, and GMX v2. Data matches venue UI within ±2% tolerance.

## Features

- **Hyperliquid:** Live funding via `/info` API — hourly rates, per-asset OI, skew estimation
- **dYdX v4:** Indexer API — `nextFundingRate`, `nextFundingAt`, oracle price, OI
- **GMX v2:** `arbitrum-api.gmxinfra.io` — funding factor per second, long/short OI split
- **Cross-venue compare:** Spot funding arb opportunities across all venues for a market
- **Standard output:** Hourly, 8h, and annualized rates; time-to-next in human format

## Actions

| Action | Description |
|--------|-------------|
| `get_funding` | Fetch funding metrics for specified markets across venues |
| `compare_funding` | Compare rates for one market across all venues |
| `echo` | Health check |

## Usage

```bash
npm install
npm start
```

Server starts on port **8094** by default.

### Example — Fetch BTC & ETH Funding

```bash
curl -X POST http://localhost:8094/invoke/get_funding \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "venue_ids": ["hyperliquid", "dydx", "gmx"],
      "markets": ["BTC", "ETH"]
    }
  }'
```

### Example — Compare Across Venues

```bash
curl -X POST http://localhost:8094/invoke/compare_funding \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "market": "ETH",
      "venue_ids": ["hyperliquid", "dydx", "gmx"]
    }
  }'
```

## Response Format (get_funding)

```json
{
  "venues": [
    {
      "venue": "hyperliquid",
      "markets": [
        {
          "venue": "hyperliquid",
          "market": "BTC",
          "funding_rate": 0.000083,
          "funding_rate_pct_8h": 0.0664,
          "funding_rate_annualized": 72.8,
          "time_to_next_seconds": 1823,
          "time_to_next_human": "30m 23s",
          "open_interest_usd": 485200000,
          "open_interest_long_usd": 266860000,
          "open_interest_short_usd": 218340000,
          "skew": 0.55,
          "skew_label": "long-heavy",
          "mark_price": 68420.5,
          "timestamp_utc": "2025-03-23T08:24:00.000Z"
        }
      ]
    }
  ],
  "total_markets": 2,
  "fetched_at": "2025-03-23T08:24:00.000Z"
}
```

## Output Fields

| Field | Description |
|-------|-------------|
| `funding_rate` | Hourly rate as decimal (e.g. 0.0001 = 0.01%/h) |
| `funding_rate_pct_8h` | 8-hour rate % (standard exchange display) |
| `funding_rate_annualized` | Annualized APR % |
| `time_to_next_seconds` | Seconds until next funding payment |
| `time_to_next_human` | Human-readable countdown |
| `open_interest_usd` | Total OI in USD |
| `skew` | Long OI / Total OI ratio |
| `skew_label` | `long-heavy` / `short-heavy` / `balanced` |

## Data Sources

| Venue | API |
|-------|-----|
| Hyperliquid | `https://api.hyperliquid.xyz/info` |
| dYdX v4 | `https://indexer.dydx.trade/v4/perpetualMarkets` |
| GMX v2 | `https://arbitrum-api.gmxinfra.io/markets/stats` |

## Tech Stack

- TypeScript + Node.js
- [Lucid Dreams Agent Kit](https://github.com/daydreamsai/lucid-agents)

## Solana Wallet

`HtCYXQBT2EVMqVrkz3a7M9EFQqg6tKnqe9bDJgQ7sXdZ`
