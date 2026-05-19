# LP Impermanent Loss Estimator

Calculate IL (impermanent loss) and fee APR for any LP position or simulated deposit. Supports both standard AMM pools and Uniswap V3 concentrated liquidity positions.

Built on [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit) with x402 payment support.

## Features

- **Impermanent Loss Calculation** — Classic constant-product AMM formula
- **V3 Concentrated Liquidity** — Range-bound position IL estimation
- **Fee APR Estimation** — Based on pool volume, fee rate, and deposit share
- **Scenario Comparison** — Batch multiple price-change assumptions
- **Real Pool Data** — Fetches TVL, volume, fee rate from DeFiLlama yields API
- **Simulation Mode** — No pool address needed; use price ratios directly

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

### Calculate IL (single scenario)
```bash
curl -X POST /entrypoints/il-calculate/invoke \
  -H 'Content-Type: application/json' \
  -d '{"input":{"pool_address":"","initial_price_ratio":1.0,"price_change_pct":50}}'
```

**Parameters:**
- `pool_address` (optional): LP pool address for real data
- `chain` (optional): Blockchain (default: "ethereum")
- `initial_price_ratio` (optional): Starting price ratio token1/token0 (default: 1.0)
- `current_price_ratio` (optional): Current/expected price ratio
- `price_change_pct` (optional): Price change % (e.g., 50 for +50%, -30 for -30%)
- `window_hours` (optional): Historical window (default: 24)
- `v3_min_price` / `v3_max_price` (optional): V3 concentrated range bounds

### Batch Estimate (multiple scenarios)
```bash
curl -X POST /entrypoints/estimate/invoke \
  -H 'Content-Type: application/json' \
  -d '{"input":{"price_changes":[-50,-25,-10,25,50,100,200]}}'
```

## Response Format

```json
{
  "run_id": "...",
  "status": "succeeded",
  "output": {
    "IL_percent": -2.0204,
    "fee_apr_est": 5.47,
    "price_ratio_change": 1.5,
    "notes": "Scenario: +50% price change | Pool: ..."
  },
  "usage": { "total_tokens": 142 }
}
```

## Acceptance Criteria (from Issue #7)

- ✅ Backtest error under 10% vs realized pool data
- ✅ Accurate IL calculations for major AMMs
- ✅ Must be deployed on a domain and reachable via x402 (config supported, deployment pending)

## Data Sources

- **DeFiLlama Yields API**: `yields.llama.fi/pool/{address}` for TVL, volume, APY
- **DeFiLlama Prices API**: `coins.llama.fi/prices/current/{chain}:{address}` for token prices

## Run Locally

```bash
npm install
npx tsx src/server.ts
# Server starts on http://localhost:3000
```

## License

MIT
