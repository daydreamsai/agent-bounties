# Perps Funding Pulse

Related bounty: #8

## Agent

Perps Funding Pulse fetches current perpetuals funding data from Hyperliquid's
official public info API. It reports funding rate, next funding tick, open
interest, mark/oracle price, premium, daily volume, and top-of-book bid/ask
depth skew for requested markets.

## Live Deployment

- Agent URL: https://perps-funding-pulse.doug-lance.workers.dev
- Manifest: https://perps-funding-pulse.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `fetch-funding`
- Invoke path: `POST /entrypoints/fetch-funding/invoke`

The deployment is reachable via x402. Unpaid invokes return HTTP 402 with
base-sepolia USDC payment requirements.

## Source

https://github.com/douglance/perps-funding-pulse

## Supported Inputs

```json
{
  "venue_ids": ["hyperliquid"],
  "markets": ["BTC", "ETH"],
  "depth_levels": 5
}
```

Supported venues:

- `hyperliquid`

## Output Summary

The agent returns:

- `funding_rate`
- `funding_rate_percent`
- `annualized_funding_percent`
- `time_to_next_seconds`
- `next_funding_time`
- `open_interest`
- `open_interest_usd`
- `mark_price`
- `oracle_price`
- `premium`
- `skew`
- `day_notional_volume_usd`
- `data_timestamp`
- `data_sources`
- `confidence`

## Acceptance Criteria Coverage

- Uses Hyperliquid's official public info API.
- Reads `metaAndAssetCtxs` for funding rate, open interest, mark price, oracle price, premium, and daily notional volume.
- Reads `l2Book` for live book depth and bid/ask skew.
- Computes next funding tick from the venue timestamp and Hyperliquid's hourly funding cadence.
- Supports multiple requested markets in one request.
- Deployed on a public domain and reachable via x402.

## Validation

Local validation:

```text
npm run build
npm test
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Direct live Hyperliquid smoke for BTC and ETH:

```json
{
  "market_count": 2,
  "first": {
    "market": "BTC",
    "funding_rate": -0.0000015412,
    "open_interest": 28251.0241,
    "time_to_next_seconds": 2523,
    "skew": {
      "bid_depth_usd": 12710.35,
      "ask_depth_usd": 3637848.85,
      "ratio": 0.0035,
      "direction": "ask-heavy",
      "source": "top-5-level-order-book-depth"
    }
  },
  "errors": [],
  "confidence": 0.92
}
```

Live endpoint checks:

```text
curl -fsS https://perps-funding-pulse.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://perps-funding-pulse.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes fetch-funding and x402 payments metadata

curl -i -X POST https://perps-funding-pulse.doug-lance.workers.dev/entrypoints/fetch-funding/invoke \
  -H 'content-type: application/json' \
  -d '{"input":{"venue_ids":["hyperliquid"],"markets":["BTC","ETH"],"depth_levels":5}}'
-> HTTP 402 with x402 payment requirements
```

## Payout Wallet

Solana: `EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
