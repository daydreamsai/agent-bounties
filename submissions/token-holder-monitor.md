# Token Holder Monitor

Closes #59

## Live Deployment
https://token-holder-monitor.netlify.app

## Agent Description
Monitors token holder distributions, tracks whale wallets, and generates alerts for
centralization risks. Uses GoPlus Security API (free, no auth) for holder data +
public RPC for large Transfer event scanning. Calculates Gini coefficient, HHI index,
and top holder percentages.

## How It Works
1. Fetches token holder data from GoPlus API (free, includes top 10 holders with %)
2. Calculates concentration metrics: Gini coefficient, HHI index, top 10/50/100 %
3. Determines centralization risk level: low/medium/high/critical
4. Generates alerts for whale wallets, concentrated ownership, and owner holdings
5. Scans recent Transfer events via public RPC for large holder movements

## Entrypoint
**Key:** `analyze`

**Input:**
```json
{
  "contract_address": "0x6b175474e89094c44da98b954eedeac495271d0f",
  "chain": "ethereum",
  "window_minutes": 60,
  "whale_threshold_pct": 1
}
```

**Output:**
```json
{
  "token_name": "Dai Stablecoin",
  "holder_count": 125000,
  "whale_wallets": [
    {
      "address": "0x...",
      "tag": "Maker: DAI contract",
      "percent": "45.2300%",
      "is_contract": true,
      "is_locked": false
    }
  ],
  "concentration_metrics": {
    "gini_coefficient": 0.85,
    "hhi_index": 2400,
    "top_10_holder_pct": 62.5,
    "top_50_holder_pct": 78.0,
    "top_100_holder_pct": 84.2
  },
  "centralization_risk": "high",
  "alerts": ["⚠️ HIGH: Top 10 wallets hold 62.5% of supply"],
  "large_transfers": [...]
}
```

## APIs Used (all free, no auth)
- **GoPlus Security** — `api.gopluslabs.io/api/v1/token_security/{chainId}` for holder data
- **Public RPC** — `eth.llamarpc.com` etc. for `eth_getLogs` large transfer scanning

## Metrics Calculated
- **Gini coefficient** (0-1): Higher = more unequal distribution
- **HHI index** (0-10000): >2500 = high concentration, >5000 = critical
- **Top N holder %**: How much % is held by top 10/50/100 addresses

## Supported Chains
ethereum, polygon, arbitrum, optimism, base, bsc

## Wallet
BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef