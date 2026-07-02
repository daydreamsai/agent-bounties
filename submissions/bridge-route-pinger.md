# Bridge Route Pinger

Closes #10

## Live Deployment
https://bridge-route-pinger.netlify.app

## Agent Description
Returns the best bridge paths for cross-chain token transfers with live fee and ETA
quotes. Powered by LiFi aggregator API (free, no auth), which aggregates 20+ bridges:
Stargate, Hop, Across, Celer, Connext, Synapse, Multichain, deBridge, Orbiter, and more.

## How It Works
1. Resolves chain name (ethereum/polygon/arbitrum/base/optimism/bsc/etc.) to chain ID
2. Resolves token symbol to contract address via LiFi's token lookup endpoint
3. Calls `GET https://li.quest/v1/routes` to get all available bridge routes
4. Summarizes each route: bridges used, `fee_usd` (gas + protocol fees), `eta_minutes`
5. Sorts by lowest fee and returns `best_route` + all alternatives

## Entrypoint
**Key:** `quote`

**Input:**
```json
{
  "token": "USDC",
  "amount": "1000000",
  "from_chain": "ethereum",
  "to_chain": "arbitrum",
  "to_token": "USDC"
}
```

**Output:**
```json
{
  "from_chain": "ethereum",
  "to_chain": "arbitrum",
  "token": "USDC",
  "routes_found": 5,
  "best_route": {
    "route_id": "...",
    "bridges": ["Stargate"],
    "from_amount_usd": "1.0000",
    "to_amount_usd": "0.9910",
    "fee_usd": "0.5234",
    "eta_minutes": 3,
    "requirements": ["Requires native gas token on source chain"]
  },
  "routes": [...]
}
```

## APIs Used
- **LiFi Aggregator** — `https://li.quest/v1/routes` + `https://li.quest/v1/token` (free, no auth)
- Aggregates: Stargate, Hop, Across, Celer, Connext, Synapse, Multichain, deBridge, Orbiter, etc.

## Supported Chains
ethereum, polygon, arbitrum, base, optimism, bsc, avalanche, gnosis, fantom, linea, scroll, zksync, mantle

## Wallet
BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef