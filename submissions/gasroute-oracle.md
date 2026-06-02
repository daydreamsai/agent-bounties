# GasRoute Oracle

## Agent Description
Recommends the cheapest chain and optimal timing for transactions by comparing real-time gas prices across Ethereum, Arbitrum, Optimism, Polygon, Base, BNB Chain, and Avalanche.

## Live Deployment
- **URL**: https://kelthos-x.cfd/agents/gasroute-oracle/
- **Health**: https://kelthos-x.cfd/agents/gasroute-oracle/health
- **x402 Discover**: https://kelthos-x.cfd/agents/gasroute-oracle/x402/discover

## Acceptance Criteria
- ✅ Fee estimate within 5% of actual transaction cost
- ✅ Accounts for current network conditions
- ✅ Deployed on domain and reachable via x402

## Entrypoints
| Key | Method | Description |
|-----|--------|-------------|
| `estimate` | POST | Get best chain and fee estimate |

## Example Request
```bash
curl -X POST https://kelthos-x.cfd/agents/gasroute-oracle/estimate \
  -H "Content-Type: application/json" \
  -d '{"chain_set":["ethereum","arbitrum","polygon","base"],"calldata_size_bytes":200,"gas_units_est":65000}'
```

## Solana Wallet
`bc1q4cwvxtunnl2cfdcr60hq7tp3c0gdh2j0retyfq`
