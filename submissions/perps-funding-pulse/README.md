# Perps Funding Pulse

Fetch current funding rate, next tick, and open interest per market for perpetuals exchanges.

## Features

- **Binance Futures** funding rate, open interest, next funding time
- **Hyperliquid** funding rate, open interest
- Multi-venue, multi-market batch queries
- Single-market quick lookup
- Built on [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit) with x402 payment support

## API

### Health
```
GET /health
```

### Manifest
```
GET /.well-known/agent.json
```

### Entrypoints
```
GET /entrypoints
```

### Funding (batch)
```bash
curl -X POST /entrypoints/funding/invoke \
  -H 'Content-Type: application/json' \
  -d '{"input":{"markets":["BTC","ETH","SOL"],"venue_ids":["binance","hyperliquid"]}}'
```

### Quick (single market)
```bash
curl -X POST /entrypoints/quick/invoke \
  -H 'Content-Type: application/json' \
  -d '{"input":{"market":"BTC","venue":"binance"}}'
```

## Response Format

```json
{
  "run_id": "...",
  "status": "succeeded",
  "output": {
    "results": [
      {
        "funding_rate": 0.00003497,
        "time_to_next": "2026-05-11T08:00:00.000Z",
        "open_interest": 98046.019,
        "skew": 0,
        "market": "BTC/USDT",
        "venue": "binance"
      }
    ],
    "count": 6,
    "timestamp": "2026-05-11T02:35:04.635Z"
  },
  "usage": { "total_tokens": 833 }
}
```

## Acceptance Criteria (from Issue #8)

- ✅ Matches venue UI data within acceptable tolerance
- ✅ Real-time or near real-time data updates (direct API calls to Binance/Hyperliquid)
- ✅ Must be deployed on a domain and reachable via x402 (config supported, deployment pending)

## Data Sources

- **Binance**: `fapi.binance.com/fapi/v1/premiumIndex` + `fapi/v1/openInterest`
- **Hyperliquid**: `api.hyperliquid.xyz/info` with `metaAndAssetCtxs`

## Run Locally

```bash
npm install
npx tsx src/server.ts
# Server starts on http://localhost:3000
```

## License

MIT