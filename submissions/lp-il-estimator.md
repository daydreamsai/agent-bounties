# LP Impermanent Loss Estimator — Submission

**Closes #7**

## Agent URL

https://lp-il-estimator.netlify.app

## Description

Computes impermanent loss and fee APR for any LP position using live and historical token prices from DeFiLlama. Supports Uniswap v2/v3, Curve, Balancer.

## Features

- **Pool lookup** by on-chain address via DeFiLlama yields API
- **Token prices** now and at entry (window_hours ago) via `coins.llama.fi`
- **IL calculation**: constant-product formula using actual deposit amounts
  - `lp_value_now` vs `hodl_value_now` → IL%
  - Notes if Uniswap v3 concentrated liquidity detected (formula is lower bound)
- **fee_apr_est**: from DeFiLlama's `apyBase` (fee component only, no rewards)
- **volume_window**: trading volume scaled to the requested window

## Entrypoint

`POST /entrypoints/estimate/invoke`

```json
{
  "pool_address": "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
  "token_weights": [50, 50],
  "deposit_amounts": ["1000", "0.5"],
  "window_hours": 24,
  "chain": "ethereum"
}
```

## Returns

```json
{
  "IL_percent": -2.35,
  "fee_apr_est": 5.2,
  "volume_window": 12345678,
  "lp_value_now": 2890.50,
  "hodl_value_now": 2959.12,
  "notes": ["Uniswap v3 detected: IL is amplified..."]
}
```

## x402 Payment

Requires x402 payment header on base-sepolia.

## Stack

- `@lucid-dreams/agent-kit` + Netlify Functions v2
- DeFiLlama Yields + Coins APIs (free, no auth)
- TypeScript

## Solana Wallet

`BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef`
