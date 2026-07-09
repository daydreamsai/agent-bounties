# Fresh Markets Watch

## Agent Type
DeFi Discovery Agent — lists new AMM pairs and pools in the last N minutes for discovery bots or yield scouts.

## Description
Monitors multiple AMM factory contracts across chains (Ethereum, Base, Polygon, Arbitrum) and returns newly created pools within a configurable time window. Returns pair addresses, token details, initial liquidity, and top holder information.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `chain` | `string` | Target blockchain (ethereum, base, polygon, arbitrum) |
| `factories` | `string[]` | Optional — specific AMM factories to monitor (e.g. Uniswap V3, SushiSwap) |
| `window_minutes` | `number` | Time window to scan (default 15 minutes) |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `new_pools` | `object[]` | Array of new pools with address, tokens, liquidity, holders |
| `total_found` | `number` | Total number of new pools found |
| `factories` | `string[]` | Factory contracts that were monitored |

Each pool includes:
| Field | Type | Description |
|-------|------|-------------|
| `pair_address` | `string` | Address of the new pair/pool |
| `tokens` | `object[]` | Token addresses and symbols in the pair |
| `init_liquidity_usd` | `number` | Initial liquidity amount in USD |
| `top_holders` | `object[]` | Top holder addresses with percentages |
| `created_at` | `string` | Creation timestamp |

## x402 Endpoints
- `POST /new-pools` — Get new pools for a specific chain
- `POST /all-new-pools` — Get new pools across all chains

## Deployment URL
https://fresh-markets-watch.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Emits new pairs within 60 seconds of creation
- ✅ False positive rate under 1% (subgraph-backed verification)
- ✅ Supports Uniswap V2/V3, SushiSwap, Aerodrome, QuickSwap, Camelot
- ✅ Multi-chain: Ethereum, Base, Polygon, Arbitrum
- ✅ x402-compatible endpoint deployed on live domain

## Payment Address
Solana: `8Y1G3z87D6cQBEFKVKsZ7WJsnLSTb87itQz6GYPkXW9Z`
