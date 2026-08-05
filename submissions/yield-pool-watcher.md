# Yield Pool Watcher

## Agent Type
DeFi Yield Monitoring Agent — tracks APY and TVL across major protocols and alerts on significant changes

## Description
Monitors Aave V3 and Uniswap V3 pools via subgraph queries, calculates APY/TVL deltas with zero-division protection, evaluates against configurable thresholds (with minimum enforcement), and generates severity-ranked alerts with 1-hour cooldown.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `protocols` | `string[]` | Protocols to monitor (aave-v3, uniswap-v3) |
| `pool_ids` | `string[]` | Optional — specific pools to watch |
| `include_deltas` | `boolean` | Whether to include APY/TVL deltas |
| `threshold_rules` | `object` | Alert thresholds: apy_change_bps, tvl_change_pct, min_tvl_usd |
| `since_hours` | `number` | Alert window (1–24h) |
| `severity` | `string` | Filter by severity (low/medium/high/all) |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `pools` | `object[]` | Pool metrics with APY, TVL, utilization |
| `deltas` | `object[]` | APY change (bps) and TVL change (%) with period |
| `alerts[]` | `object[]` | Triggered alerts with type and severity |
| `total` | `number` | Total alert count |

## x402 Endpoints
- `POST /entrypoints/metrics/invoke` — Pool metrics with deltas ($0.001)
- `POST /entrypoints/alerts/invoke` — Threshold alerts ($0.002)
- `POST /entrypoints/health/invoke` — Health check (free)

## Deployment URL
https://yield-pool-watcher-five.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Detects TVL or APY change beyond thresholds within 1 block (subgraph polling)
- ✅ Accurate metric tracking across Aave V3 and Uniswap V3 (subgraph live data)
- ✅ Deployed on a domain and reachable via x402 (https://yield-pool-watcher-five.vercel.app)
- ✅ 30/30 vitest tests passing (KV, deltas, thresholds, severity, cooldown)

## Payment Address
USDC (Base) via x402 — treasury: `0x61090c6e6fbdaee9d695c6d164a3ead268aea4ac`

## Source
https://github.com/yunaremaia/yield-pool-watcher
