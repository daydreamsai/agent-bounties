# GasRoute Oracle

## Agent Type
DeFi Gas Optimization Agent — recommends cheapest chain and optimal timing for transactions

## Description
Analyzes gas prices across multiple chains (Ethereum, Base, Solana, Polygon, Arbitrum, Optimism) and recommends the cheapest chain and best timing for transactions based on calldata size and gas units.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `chain_set` | `string[]` | Chains to evaluate (e.g. ethereum, base, solana, polygon, arbitrum, optimism) |
| `calldata_size_bytes` | `number` | Calldata size in bytes for the transaction |
| `gas_units_est` | `number` | Estimated gas units needed |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `recommended_chain` | `string` | Cheapest chain for the transaction |
| `fee_native` | `number` | Estimated fee in native token |
| `fee_usd` | `number` | Estimated fee in USD |
| `congestion` | `string` | Current congestion level (low/medium/high) |
| `tip_hint` | `string` | Suggestion for priority tip |
| `all_routes` | `object[]` | Fee breakdown for all evaluated chains |

## x402 Endpoint
- `POST /best-route` — Get cheapest chain and gas estimates

## Deployment URL
https://gasroute-oracle.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Compares gas fees across 6+ chains in real-time
- ✅ Fee estimate accuracy within 5%
- ✅ Accounts for calldata size in cost calculation
- ✅ Provides congestion level and tip hints
- ✅ x402-compatible endpoint deployed on live domain

## Payment Address
Solana: `8Y1G3z87D6cQBEFKVKsZ7WJsnLSTb87itQz6GYPkXW9Z`
