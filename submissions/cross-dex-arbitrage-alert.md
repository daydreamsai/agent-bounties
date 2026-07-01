# Cross DEX Arbitrage Alert

Closes #2

## Live Deployment
https://cross-dex-arbitrage-alert.netlify.app

## Agent Description
Scans multiple chains and DEXes simultaneously to detect profitable price spreads.
Uses KyberSwap aggregator quotes (free, no auth) per chain and per major DEX source
(Uniswap V3/V2, SushiSwap, Curve, Balancer, etc.) to find the best route and
compare it against alternatives. Accounts for chain-specific gas costs and DEX fees.

## How It Works
1. For each requested chain, queries KyberSwap `GET /routes` both as aggregated best
   route and individually per major DEX source (via `includedSources` filter)
2. All queries run in parallel (`Promise.all`) for speed
3. Routes are sorted by net amount out (after gas deduction)
4. `net_spread_bps = (best_net_usd - alt_net_usd) / alt_net_usd × 10000`
5. `est_fill_cost = chain_gas_usd + (amount_out_usd × 0.3%)` (avg DEX fee)

## Entrypoint
**Key:** `alert`

**Input:**
```json
{
  "token_in": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "token_out": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "amount_in": "1000000000",
  "chains": ["ethereum", "arbitrum", "base", "optimism"],
  "min_spread_bps": 50
}
```

**Output:**
```json
{
  "profitable": true,
  "net_spread_bps": 87,
  "best_route": {
    "chain": "arbitrum",
    "dex": "UNISWAP_V3",
    "amount_out": "321456789",
    "amount_out_usd": "1002.45",
    "gas_cost_usd": "0.10",
    "net_amount_out_usd": "1002.35",
    "price_impact_pct": "0.0234",
    "route_summary": "UNISWAP_V3"
  },
  "alt_routes": [...],
  "est_fill_cost": {
    "gas_usd": "0.1000",
    "dex_fee_usd": "3.0074",
    "total_usd": "3.1074"
  }
}
```

## APIs Used
- **KyberSwap Aggregator** — `https://aggregator-api.kyberswap.com/{chain}/api/v1/routes` (free, no auth)

## Supported Chains
ethereum, polygon, arbitrum, base, optimism, bsc, avalanche

## Wallet
BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef
