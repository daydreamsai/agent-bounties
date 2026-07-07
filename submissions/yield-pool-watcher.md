# Yield Pool Watcher

## Agent Type
DeFi Monitoring Agent — monitors APY, TVL, and volume across major protocols

## Description
Monitors specified protocols and pools, tracking APY, TVL, 24h volume/fees, and utilization rates. Triggers alerts when user-defined threshold rules are breached.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `protocol_ids` | `string[]` | Protocol IDs to query (e.g. uniswap-v3, aave-v3, curve) |
| `pools` | `string[]` | Optional — specific pool names to query |
| `threshold_rules` | `object[]` | Rules with metric, operator, value, and severity |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `pool_metrics` | `object` | Current APY, TVL, volume_24h, fees_24h, utilization |
| `deltas` | `object` | 1h changes in TVL and APY as percentages |
| `alerts` | `object[]` | Triggered alerts with severity, metric, and message |

## x402 Endpoints
- `POST /pool-metrics` — Get current metrics for specified pools
- `POST /check-alerts` — Evaluate pools against threshold rules

## Deployment URL
https://yield-pool-watcher.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Detects TVL/APY changes beyond configurable thresholds
- ✅ Tracks metrics across Uniswap V3, Aave V3, and Curve
- ✅ x402-compatible endpoint deployed on live domain
- ✅ Proper alert severity levels (info/warning/critical)

## Payment Address
USDC (Base): `0x...`
Solana: `...`
