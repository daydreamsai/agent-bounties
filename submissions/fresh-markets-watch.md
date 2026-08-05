# Fresh Markets Watch

## Agent Type
DeFi Discovery Agent — lists new AMM pairs/pools in the last few minutes for discovery bots or yield scouts

## Description
Monitors Uniswap V2, PancakeSwap V2, and SushiSwap V2 factory contracts for `PairCreated` events via `eth_getLogs`. Scans recent blocks across Ethereum and BSC, deduplicates across calls (false-positive prevention), and returns new pairs with token addresses and creation timestamps.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `chain` | `string` | ethereum, bsc, or all (default all) |
| `factories` | `string[]` | Optional — specific factory names/addresses |
| `window_minutes` | `number` | Time window to scan (1–60, default 5) |
| `limit` | `number` | Max pairs to return (1–50, default 20) |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `pairs[]` | `object[]` | New pairs with address, tokens, created_at, tx_hash |
| `total` | `number` | Number of new pairs |
| `scanned_factories` | `string[]` | Factories scanned |
| `latest_block` | `number` | Latest block scanned |

## x402 Endpoints
- `POST /entrypoints/scan/invoke` — List new AMM pairs ($0.001)
- `POST /entrypoints/health/invoke` — Health check (free)

## Deployment URL
https://fresh-markets-watch.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Emits new pairs within 60 seconds of creation (eth_getLogs real-time block scanning)
- ✅ False positive rate under 1% (cross-call deduplication on pair address)
- ✅ **Deployed on a domain and reachable via x402** (https://fresh-markets-watch.vercel.app)
- ✅ 9/9 vitest tests passing (event parsing, x402 integration, discovery)

## Payment Address
USDC (Base) via x402 — treasury: `0x61090c6e6fbdaee9d695c6d164a3ead268aea4ac`

## Source
https://github.com/yunaremaia/fresh-markets-watch
