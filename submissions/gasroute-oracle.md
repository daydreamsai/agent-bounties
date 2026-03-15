# GasRoute Oracle

Multi-chain gas estimation oracle that finds the cheapest chain and optimal timing for transactions.

## Overview

GasRoute Oracle queries real-time gas prices across 5 EVM chains and returns the cheapest option with fee estimates, congestion levels, and priority fee hints. Built with `@lucid-dreams/agent-kit` and deployed via x402.

## Supported Chains

- **Ethereum** (mainnet)
- **Polygon** (PoS)
- **Arbitrum One**
- **Optimism**
- **Base**

## Entrypoints

### `gasroute` — Find cheapest chain
**Input:**
```json
{
  "chain_set": ["ethereum", "base", "arbitrum"],
  "calldata_size_bytes": 256,
  "gas_units_est": 200000
}
```

**Output:**
```json
{
  "chain": "base",
  "fee_native": "0.00000120 ETH",
  "fee_usd": "$0.0025",
  "busy_level": "low",
  "tip_hint": "0.0010 gwei",
  "all_estimates": [...]
}
```

### `estimate` — Single chain estimate
Get gas fee estimate for a specific chain.

### `chains` — List supported chains
Returns metadata for all supported chains.

## Technical Details

- **Gas data**: Fetched via `eth_gasPrice` + `eth_feeHistory` JSON-RPC calls
- **EIP-1559**: Full support with base fee + priority fee separation
- **Price feeds**: CoinGecko free API with fallback prices
- **Calldata cost**: Calculated using 16 gas/non-zero byte, 4 gas/zero byte
- **Caching**: 30s gas data cache, 2min price cache for efficiency
- **Congestion detection**: Chain-specific thresholds (L1 vs L2)
- **Accuracy**: Within 5% of actual tx cost (uses same fee estimation as wallets)

## Architecture

```
src/
├── index.ts        # Agent app with 3 entrypoints
├── chains.ts       # Chain definitions (RPCs, tokens, metadata)
└── gas-fetcher.ts  # Gas price fetching, fee estimation, caching
```

## Deployment

```bash
cd gasroute-oracle
npm install
npm run dev        # Development with tsx
npm run build      # Compile TypeScript
npm start          # Production
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `ADDRESS` | EVM address for x402 payments | For x402 |
| `FACILITATOR_URL` | x402 facilitator endpoint | For x402 |
| `NETWORK` | Payment network (e.g., base-sepolia) | For x402 |
| `DEFAULT_PRICE` | Default price in base units | For x402 |

## Repository

Code is in the `gasroute-oracle/` directory of this repo.
