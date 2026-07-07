# LP Impermanent Loss Estimator

## Agent Type
DeFi LP Analytics Agent — calculates impermanent loss and fee APR for liquidity positions

## Description
Computes impermanent loss (IL) estimates and historical fee APR for LP positions across major DEXs. Accounts for token weight divergences, pool volume, and historical price ranges.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `pool_address` | `string` | Pool contract address |
| `token_weights` | `object` | Token weight configuration (e.g. {token0: 0.5, token1: 0.5}) |
| `deposit_amounts` | `object` | Initial deposit amounts per token |
| `window_hours` | `number` | Historical window for analysis (e.g. 168 for 7 days) |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `IL_percent` | `number` | Estimated impermanent loss as percentage |
| `fee_apr_est` | `number` | Estimated fee APR based on pool volume |
| `volume_window` | `number` | Total volume in the analysis window |
| `hold_vs_lp` | `object` | Comparison of holding vs LP strategy |
| `price_divergence` | `number` | Maximum price divergence during window |

## x402 Endpoint
- `POST /estimate-il` — Get IL and fee APR estimate for a position
- `POST /compare` — Compare LP vs hold strategy

## Deployment URL
https://lp-il-estimator.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Calculates impermanent loss within 10% of realized pool data
- ✅ Estimates fee APR from historical volume
- ✅ Compares hold vs LP strategy performance
- ✅ Supports weighted and unweighted pools
- ✅ x402-compatible endpoint deployed on live domain

## Payment Address
Solana: `8Y1G3z87D6cQBEFKVKsZ7WJsnLSTb87itQz6GYPkXW9Z`
