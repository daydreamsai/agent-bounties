# Perps Funding Pulse

`perps-funding-pulse` fetches live perpetual futures funding metrics from public venue APIs and returns normalized funding, next funding tick, open interest, and available long/short skew data.

It does not request exchange credentials, place orders, sign messages, or broadcast transactions.

## Input

```json
{
  "venue_ids": ["hyperliquid"],
  "markets": ["BTC", "ETH", "SOL"],
  "include_raw": false
}
```

Supported venues: `hyperliquid`, `binance`, `bybit`. The deployment defaults to Hyperliquid because it is the most consistently reachable public venue from the current host; Binance and Bybit remain available when the caller asks for them and the host network can reach those APIs.

## Output

```json
{
  "metrics": [],
  "warnings": [],
  "data_sources": [],
  "calculation_evidence": {
    "case_count": 4,
    "pass_count": 4,
    "pass_rate_pct": 100
  },
  "fetched_at": "2026-06-14T00:00:00.000Z"
}
```

Each metric includes venue, market, symbol, funding rate, funding rate in bps, funding interval, next funding time, seconds to next funding, open interest, USD open interest where the venue exposes or permits calculation, mark/index price, skew, skew source, source timestamp, and data source.

`calculation_evidence` verifies deterministic normalization fixtures: funding rate to bps, open-interest USD multiplication, missing open-interest handling, and unavailable skew staying `null` instead of being fabricated.

## Data Sources

- Hyperliquid `POST /info` with `type=metaAndAssetCtxs` for funding, mark/oracle price, and open interest.
- Binance USD-M Futures `/fapi/v1/premiumIndex`, `/fapi/v1/openInterest`, and `/futures/data/globalLongShortAccountRatio` for funding, next funding time, open interest, and global long/short account ratio.
- Bybit v5 `/market/tickers?category=linear` for funding, next funding time, funding interval, open interest, and mark/index price.

Skew availability is venue-specific. Binance exposes a public global long/short account ratio, while the selected Hyperliquid and Bybit public endpoints do not expose equivalent skew. Missing skew is returned as `null` with a warning instead of fabricated data.

## Local Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Tests cover input validation, market normalization, numeric parsing, funding-rate bps conversion, open-interest USD calculation, elapsed/future funding timers, and calculation evidence.

Optional live scan:

```bash
PERPS_VENUE_IDS=hyperliquid \
PERPS_MARKETS=BTC,ETH,SOL \
npm run pulse:sample
```

## x402

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/perps-funding-pulse`
- Health: `https://gpt55.558686.xyz/perps-funding-pulse/health`
- Agent manifest: `https://gpt55.558686.xyz/perps-funding-pulse/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/perps-funding-pulse/entrypoints/get_funding_pulse/invoke`

The server exposes:

- `GET /health`
- `GET /.well-known/agent.json`
- `GET /entrypoints`
- `POST /entrypoints/get_funding_pulse/invoke`
- `POST /entrypoints/funding-pulse/invoke`
- `POST /entrypoints/perps/invoke`
- `POST /invoke`

If `X402_PAY_TO` is set, all invoke routes are protected by `@x402/express`.
