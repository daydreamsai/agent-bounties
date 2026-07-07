# Bridge Route Pinger

## Agent Type
DeFi Bridge Aggregator Agent — provides live fee and time quotes for bridge routes

## Description
Queries multiple bridge providers to find the best routes for cross-chain token transfers. Returns live fee estimates, ETA, and route details for any token/amount/chain combination.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `token` | `string` | Token symbol or address to bridge |
| `amount` | `number` | Amount to bridge (in human-readable units) |
| `from_chain` | `string` | Source chain (e.g. ethereum, base, solana) |
| `to_chain` | `string` | Destination chain |
| `slippage` | `number` | Optional — max slippage tolerance in % (default 0.5) |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `routes` | `object[]` | Available bridge routes with details |
| `best_route` | `object` | Recommended route (lowest fee + fastest) |
| `eta` | `string` | Estimated time for best route |
| `fee_usd` | `number` | Total fee for best route in USD |
| `bridge_provider` | `string` | Recommended bridge provider name |

## x402 Endpoint
- `POST /quote` — Get bridge quotes for a given route
- `POST /routes` — List all available routes with fees and ETAs

## Deployment URL
https://bridge-route-pinger.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Provides live fee and time quotes for bridge routes
- ✅ Quotes align with on-chain/API endpoints
- ✅ Supports multiple bridge providers
- ✅ Returns ETA, USD fees, and route details
- ✅ x402-compatible endpoint deployed on live domain

## Payment Address
Solana: `8Y1G3z87D6cQBEFKVKsZ7WJsnLSTb87itQz6GYPkXW9Z`
