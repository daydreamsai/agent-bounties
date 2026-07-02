# GasRoute Oracle Submission

## Agent Description

GasRoute Oracle is an AI agent that recommends the cheapest chain and optimal timing for transactions across multiple EVM chains. It provides accurate gas cost estimates with current network conditions.

## Live Deployment

- **URL**: https://gasroute-oracle.vercel.app
- **x402 Endpoint**: https://gasroute-oracle.vercel.app/x402

## Repository

https://github.com/your-username/gasroute-oracle

## Acceptance Criteria Checklist

- [x] Fee estimate within 5% of actual transaction cost
- [x] Accounts for current network conditions
- [x] Deployed on a domain and reachable via x402

## How It Works

The agent exposes an `estimateGas` entrypoint that:

1. Fetches real-time gas prices from supported chains via public RPC endpoints
2. Calculates native token fees using: `(baseFee + priorityFee) * gasUnits`
3. Converts native fees to USD using cached price feeds
4. Returns congestion level (`low` | `medium` | `high` | `extreme`) based on percentile
5. Provides a `tip_hint` for priority fee bidding

### Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| Ethereum | 1 | ✅ Live |
| Polygon | 137 | ✅ Live |
| Arbitrum | 42161 | ✅ Live |
| Optimism | 10 | ✅ Live |
| Base | 8453 | ✅ Live |
| BSC | 56 | ✅ Live |

### Example Request

