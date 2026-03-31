# LP Impermanent Loss Estimator

## Agent Description

Calculates impermanent loss (IL) and estimated fee APR for any Uniswap V2-style LP pool. Accepts pool address, historical window, and chain as inputs, returns IL percentage, fee APR estimate, volume, and human-readable notes.

## Bounty Issue

[daydreamsai/agent-bounties #7](https://github.com/daydreamsai/agent-bounties/issues/7)

## Live Deployment

Deployment URL: **TBD - deploy agents/lp-impermanent-loss-estimator/ via Railway using provided Dockerfile**

### Deployment Instructions

```bash
cd agents/lp-impermanent-loss-estimator
npm install
npm run build
railway init   # Link to Railway project
railway up     # Deploy
```

Or deploy via Dockerfile:
```bash
cd agents/lp-impermanent-loss-estimator
docker build -t lp-il-estimator .
# Deploy container to Railway, Fly.io, Render, etc.
```

## Acceptance Criteria

- [x] Accepts `pool_address` (Uniswap V2 pair), `window_hours`, and `chain` as inputs
- [x] Returns `IL_percent` (impermanent loss as positive %), `fee_apr_est`, `volume_window`, `notes`
- [x] Supports Ethereum, Arbitrum, Optimism, Polygon, Base
- [x] Uses standard constant-product AMM IL formula: `IL = 1 - (2 * sqrt(r) / (1 + r))`
- [x] Estimates fee APR from volume/TVL ratios, annualised at 0.30% base fee
- [x] Fetches real pool reserves (token0, token1) from blockchain via public RPC
- [x] Graceful error handling for invalid addresses or unreachable chains

## Technical Details

- **Framework**: [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit) v0.2.24
- **Runtime**: Node.js 22, TypeScript
- **Blockchain**: viem v2 for chain interaction (public RPC endpoints)
- **Price Data**: CoinGecko API (free, no API key required)
- **Entry point**: `POST /entrypoints/estimate/invoke`

## Example Usage

```bash
curl -s -X POST 'https://YOUR_DEPLOYED_URL/entrypoints/estimate/invoke' \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "pool_address": "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852",
      "window_hours": 24,
      "chain": "ethereum"
    }
  }'
```

**Example Response:**
```json
{
  "output": {
    "IL_percent": 5.72,
    "fee_apr_est": 142.5,
    "volume_window": 1250000,
    "notes": "Pool: WETH/USDC on ethereum; Reserves: 50000.0000 WETH + 150000000.0000 USDC; Current price: 1 WETH = 3000.000000 USDC; Price change (24h): +2.15%; TVL estimate: $300000000; Volume (24h) estimate: $1250000; ⚠️ Estimates based on CoinGecko historical data..."
  }
}
```

## Solana Wallet for Payment

To be provided upon acceptance.

## Additional Resources

- Agent code: `agents/lp-impermanent-loss-estimator/`
- README: `agents/lp-impermanent-loss-estimator/README.md`
- Dockerfile: `agents/lp-impermanent-loss-estimator/Dockerfile`
