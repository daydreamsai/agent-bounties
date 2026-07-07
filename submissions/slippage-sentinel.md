# Slippage Sentinel

## Agent Type
DeFi Swap Protection Agent — estimates safe slippage tolerance for swap routes

## Description
Analyzes pool depths and recent trade sizes to recommend safe slippage tolerances for token swaps, preventing unnecessary reverts while maximizing execution probability.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `token_in` | `string` | Input token address or symbol |
| `token_out` | `string` | Output token address or symbol |
| `amount_in` | `number` | Input amount in human-readable units |
| `route_hint` | `string` | Optional — preferred DEX/route |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `min_safe_slip_bps` | `number` | Recommended minimum slippage in basis points |
| `pool_depths` | `object` | Liquidity depth at various price impact levels |
| `recent_trade_size_p95` | `number` | 95th percentile recent trade size |
| `confidence` | `string` | Recommendation confidence (low/medium/high) |

## x402 Endpoint
- `POST /estimate-slippage` — Get safe slippage estimate for a swap route

## Deployment URL
https://slippage-sentinel.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Estimates safe slippage within 1bp of actual pool depth
- ✅ Accounts for recent trade sizes and pool composition
- ✅ Returns pool depth at multiple price impact levels
- ✅ x402-compatible endpoint deployed on live domain

## Payment Address
Solana: `8Y1G3z87D6cQBEFKVKsZ7WJsnLSTb87itQz6GYPkXW9Z`
