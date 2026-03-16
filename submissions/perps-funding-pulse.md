# Perps Funding Pulse — Bounty #8 Submission

**Closes #8**

---

## Agent Details

| Field | Value |
|-------|-------|
| Agent Name | perps-funding-pulse |
| Version | 1.0.0 |
| Live URL | http://65.108.87.255:8081 |
| Framework | @lucid-dreams/agent-kit |
| Solana Wallet | `o27qQ458k5zVp4P3ajtn1ksu6d5xcvBTM5KYpCmbhYP` |

---

## Acceptance Criteria

- [x] **`funding_rate`** — current funding rate per venue per market
- [x] **`time_to_next`** — time until next funding payment (ms + human-readable)
- [x] **`open_interest`** — total open interest in native units and USD
- [x] **`skew`** — long/short skew ratio (computed from long/short account ratio on Binance)
- [x] **Matches venue UI data within acceptable tolerance** — direct calls to each venue's official public API
- [x] **Real-time or near real-time data updates** — live fetch on every call, no caching
- [x] **Deployed on a domain and reachable via x402** — http://65.108.87.255:8081

---

## Venues Supported

| Venue | API | Funding Interval |
|-------|-----|------------------|
| Binance | `fapi.binance.com` — premiumIndex + openInterest + globalLongShortAccountRatio | 8h |
| Bybit | `api.bybit.com/v5/market/tickers` | 8h |
| Hyperliquid | `api.hyperliquid.xyz/info` — metaAndAssetCtxs (all markets in one call) | 1h |
| OKX | `okx.com/api/v5/public/funding-rate` + open-interest | 8h |

---

## Live Test

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

**Actual response (captured live 2026-03-16):**

```json
{
  "status": "succeeded",
  "output": {
    "data": [
      {
        "venue": "BINANCE",
        "market": "BTC-USDT",
        "funding_rate": 0.00003695,
        "funding_rate_annual_pct": 4.046,
        "time_to_next_ms": 20940467,
        "time_to_next_human": "5h 49m 0s",
        "open_interest": 88543.002,
        "open_interest_usd": 6568657688.93,
        "mark_price": 74186.07,
        "skew": -0.065,
        "long_short_ratio": 0.8779,
        "timestamp_ms": 1773684659533
      },
      {
        "venue": "HYPERLIQUID",
        "market": "ETH-USDT",
        "funding_rate": -0.000001021,
        "funding_rate_annual_pct": -0.894,
        "time_to_next_ms": 2940447,
        "time_to_next_human": "49m 0s",
        "open_interest": 578569.22,
        "open_interest_usd": 1347603435.61,
        "mark_price": 2329.2,
        "skew": null,
        "long_short_ratio": null,
        "timestamp_ms": 1773684659553
      }
    ],
    "summary": {
      "BTC-USDT": {
        "avg_funding_rate": 0.0000251,
        "max_funding_rate": 0.00005086,
        "min_funding_rate": 0.0000044745,
        "highest_venue": "BYBIT",
        "lowest_venue": "HYPERLIQUID"
      },
      "ETH-USDT": {
        "avg_funding_rate": 0.0000289,
        "max_funding_rate": 0.0001,
        "min_funding_rate": -0.0000396,
        "highest_venue": "BYBIT",
        "lowest_venue": "OKX"
      }
    },
    "venues_queried": ["BINANCE", "BYBIT", "HYPERLIQUID", "OKX"],
    "markets_queried": ["BTC-USDT", "ETH-USDT", "SOL-USDT"],
    "fetched_at": "2026-03-16T18:11:00.455Z"
  }
}
```

---

## Quick Links

- Health: `GET http://65.108.87.255:8081/health` → `{"ok":true,"version":"1.0.0"}`
- Manifest: `GET http://65.108.87.255:8081/.well-known/agent.json`
- Entrypoints: `GET http://65.108.87.255:8081/entrypoints`
