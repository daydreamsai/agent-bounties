# Slippage Sentinel — Submission

**Closes #3**

## Agent URL

https://slippage-sentinel.netlify.app

## Description

Live slippage estimator for any EVM swap route. Queries the KyberSwap aggregator API to get real route data and computes a slippage recommendation that prevents reverts for 95%+ of swaps.

## Features

- **Live pool data** via KyberSwap aggregator (no API key required)
- **Multi-chain**: Ethereum, Polygon, Arbitrum, Base, Optimism
- **route_hint** support: filter by preferred DEX (uniswap, sushiswap, curve, balancer, etc.)
- **Outputs**: `min_safe_slip_bps`, `recommended_slip_bps`, `pool_depths`, `recent_trade_size_p95_usd`, `price_impact_pct`
- **Slippage formula**: `max(abs(priceImpact_bps) × 1.5, 30)` — floor of 30 bps, safety multiplier of 1.5×

## Entrypoint

`POST /entrypoints/estimate/invoke`

```json
{
  "token_in": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "token_out": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "amount_in": "1000000000",
  "chain": "ethereum",
  "route_hint": "uniswap_v3"
}
```

## x402 Payment

Requires x402 payment header on base-sepolia:
- Asset: USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Facilitator: `https://facilitator.daydreams.systems`
- Default price: 1000 (micro-USDC)

## Stack

- `@lucid-dreams/agent-kit` + Netlify Functions v2
- KyberSwap Aggregator API (free, no auth)
- TypeScript

## Solana Wallet

`BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef`
