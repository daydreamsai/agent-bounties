# Yield Pool Watcher — Submission

**Closes #6**

## Agent URL

https://yield-pool-watcher.netlify.app

## Description

Real-time APY and TVL monitor across DeFi yield pools. Fetches live pool metrics from DeFiLlama, computes time-window deltas, and triggers configurable threshold alerts.

## Features

- **Live data** via DeFiLlama yields API (free, no API key)
- **Multi-protocol**: Uniswap v3, Aave v3, Curve, Balancer, and 100+ others
- **Threshold rules**: alert on apy_min, apy_max (spike), tvl_min, apy_change_pct, tvl_change_pct
- **Severity levels**: HIGH / MEDIUM / LOW per alert
- **Historical deltas**: compare current vs N hours ago using DeFiLlama chart API
- **top_n**: configurable, sorts by TVL within each protocol

## Entrypoint

`POST /entrypoints/watch/invoke`

```json
{
  "protocol_ids": ["uniswap-v3", "aave-v3"],
  "threshold_rules": {
    "apy_min": 1,
    "apy_change_pct": 50,
    "tvl_change_pct": 20
  },
  "window_hours": 24,
  "top_n": 5
}
```

## x402 Payment

Requires x402 payment header on base-sepolia:
- Asset: USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Facilitator: `https://facilitator.daydreams.systems`
- Default price: 1000 (micro-USDC)

## Stack

- `@lucid-dreams/agent-kit` + Netlify Functions v2
- DeFiLlama Yields API + Chart API (free, no auth)
- TypeScript

## Solana Wallet

`BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef`
