# Cross DEX Arbitrage Alert

## Agent Type
DeFi Arbitrage Detection Agent — flags price spreads across DEXs after fees and gas to spot profitable swaps.

## Description
Compares token prices across multiple DEXes and chains, calculates net spreads after accounting for DEX fees, gas costs, and cross-chain bridging costs. Returns ranked arbitrage opportunities with estimated profitability.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `token_in` | `string` | Input token symbol or address |
| `token_out` | `string` | Output token symbol or address |
| `amount_in` | `number` | Amount to swap in human-readable units |
| `chains` | `string[]` | Optional — chains to scan (default: ethereum, base, polygon, arbitrum) |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `best_route` | `object` | Optimal arbitrage route with buy/sell DEX, spread, and profit |
| `alt_routes` | `object[]` | Alternative profitable routes (up to 5) |
| `net_spread_bps` | `number` | Net spread in basis points after fees |
| `est_fill_cost` | `number` | Estimated cost including fees and gas |
| `market_overview` | `object` | Lowest/highest prices and gross spread |

## x402 Endpoint
- `POST /find-arbitrage` — Find profitable arbitrage opportunities
- `GET /supported-dexes` — List all supported DEXes and chains

## Deployment URL
https://cross-dex-arbitrage-alert.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Spread and cost calculations match on-chain quotes within 1%
- ✅ Accounts for gas costs, DEX fees, and cross-chain bridging costs
- ✅ Supports 11+ DEXes across 5 chains (Ethereum, Base, Polygon, Arbitrum, Solana)
- ✅ Returns ranked routes sorted by net profitability
- ✅ x402-compatible endpoint deployed on live domain

## Payment Address
Solana: `8Y1G3z87D6cQBEFKVKsZ7WJsnLSTb87itQz6GYPkXW9Z`
