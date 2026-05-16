# Perps Funding Pulse Agent

Real-time perpetuals funding rate monitor with cross-venue arbitrage detection.

Built with `@lucid-dreams/agent-kit`, deployable via x402.

## Venues

- **Binance** (`premiumIndex` + `openInterest`)
- **Hyperliquid** (`meta` + `assetCtxs`)
- **GMX** (v2 Reader contract on Arbitrum)
- **dYdX** (v4 API indexer)

## Entrypoints

| Name | Description |
|---|---|
| `funding` | Full funding data for all venues, normalized to 8h APR% |
| `quick` | Brief summary — top 3 longs/shorts |
| `arbitrage` | Cross-venue arbitrage opportunities (spread ≥ threshold) |
| `historical` | Recent funding rate history from Hyperliquid candle snapshots |
| `alerts` | Symbols with extreme funding rates (long or short) |

## API

### `POST /funding`
Get normalized funding rates across all venues.

Request:
```json
{
  "entrypoint": "funding",
  "params": {}
}
```

### `POST /quick`
Quick snapshot of top longs and shorts.

```json
{
  "entrypoint": "quick",
  "params": {}
}
```

### `POST /arbitrage`
Cross-venue arbitrage detection.

```json
{
  "entrypoint": "arbitrage",
  "params": {},
  "data": { "thresholdPercent": 0.05 }
}
```

### `POST /historical`
Funding rate history for a symbol.

```json
{
  "entrypoint": "historical",
  "params": {},
  "data": { "coin": "BTC", "hours": 24 }
}
```

### `POST /alerts`
Symbols with extreme funding rates.

```json
{
  "entrypoint": "alerts",
  "params": {},
  "data": { "thresholdPercent": 0.1 }
}
```

## Response format

```json
{
  "type": "funding_snapshot",
  "timestamp": "2026-05-16T12:00:00.000Z",
  "venue_count": 4,
  "total_symbols": 42,
  "data": [...]
}
```

## Running locally

```bash
npm install
npm run dev   # starts on port 3000
```

## Deployment (Cloudflare Workers)

```bash
npx wrangler deploy
```

## Agent manifest

`GET /.well-known/agent.json`
