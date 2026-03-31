# LP Impermanent Loss Estimator

Calculate impermanent loss and fee APR for any Uniswap V2-style LP pool.

## Agent Description

This agent calculates:
- **IL_percent**: Impermanent loss as a positive percentage (e.g., 5.7 = 5.7% loss)
- **fee_apr_est**: Estimated fee APR based on volume/TVL ratios
- **volume_window**: Estimated trading volume in USD over the window
- **notes**: Human-readable notes about the calculation

## Supported Chains

- Ethereum
- Arbitrum
- Optimism
- Polygon
- Base

## Deployment

### Railway (Recommended)

```bash
cd agents/lp-impermanent-loss-estimator
npm install
npm run build
railway init
railway up
```

Or deploy via Dockerfile:

```bash
cd agents/lp-impermanent-loss-estimator
docker build -t lp-il-estimator .
# Deploy to any container host (Railway, Fly.io, Render, etc.)
```

### Environment Variables

- `PORT` (optional, default: 3000)

## API

### POST /entrypoints/estimate/invoke

```bash
curl -s -X POST 'https://your-url.com/entrypoints/estimate/invoke' \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "pool_address": "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852",
      "window_hours": 24,
      "chain": "ethereum"
    }
  }'
```

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `pool_address` | string | Yes | - | Uniswap V2 pair contract address |
| `window_hours` | number | No | 24 | Historical window in hours |
| `chain` | string | No | "ethereum" | Blockchain name |
| `token_weights` | number[] | No | [50, 50] | Token weight distribution |
| `deposit_amounts` | number[] | No | - | Token amounts deposited |

### Response

```json
{
  "output": {
    "IL_percent": 5.72,
    "fee_apr_est": 142.5,
    "volume_window": 1250000,
    "notes": "Pool: WETH/USDC on ethereum; Reserves: 50000.0000 WETH + 150000000.0000 USDC; ..."
  }
}
```

## How IL is Calculated

Uses the standard constant-product AMM (Uniswap V2) IL formula:

```
IL = 1 - (2 * sqrt(price_ratio) / (1 + price_ratio))
```

Where `price_ratio = current_price / initial_price`.

Examples:
- 2x price change → ~5.7% loss
- 5x price change → ~25.5% loss
- 10x price change → ~42.0% loss

## Fee APR Estimation

Fee APR is estimated from the volume/TVL ratio over the specified window, annualised at 0.30% base fee (Uniswap V2 standard):

```
feeAPR = (volume_USD / TVL_USD) * 0.003 * (8760 / window_hours) * 100
```

## Notes

- IL is always negative (a loss), returned as a positive percentage
- Fee APR estimates are based on volume data from CoinGecko
- Actual IL varies with exact entry/exit timing
- This tool does not account for impermanent loss hedging from fee income
- For production use, verify calculations with official pool analytics

## Acceptance Criteria

- [x] Accepts pool_address (Uniswap V2 pair), window_hours, chain as inputs
- [x] Returns IL_percent, fee_apr_est, volume_window, notes
- [x] Supports Ethereum, Arbitrum, Optimism, Polygon, Base
- [x] Uses standard constant-product AMM IL formula
- [x] Estimates fee APR from volume/TVL ratios
- [x] Fetches real pool reserves from blockchain
- [x] Graceful error handling for invalid addresses
