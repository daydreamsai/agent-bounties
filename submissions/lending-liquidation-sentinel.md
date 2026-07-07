# Lending Liquidation Sentinel

## Agent Type
DeFi Risk Monitoring Agent — monitors borrow positions and alerts before liquidation

## Description
Monitors wallet positions across lending protocols (Aave V3, Compound V3) and provides real-time health factor, liquidation price, and safety buffer. Fires alerts when positions approach liquidation risk.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `wallet` | `string` | Wallet address to monitor |
| `protocol_ids` | `string[]` | Protocols to query (e.g. aave-v3, compound-v3) |
| `positions` | `object[]` | Positions with pool_id, collateral_amount, borrow_amount |
| `alert_threshold` | `number` | Optional — alert when health factor drops below (default 1.5) |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `health_factor` | `number` | Current health factor (e.g. 1.25 = 25% above liquidation) |
| `liq_price` | `number` | Liquidation price threshold in USD |
| `buffer_percent` | `number` | Percentage buffer above liquidation |
| `severity` | `string` | safe / warning / critical |

## x402 Endpoints
- `POST /check-positions` — Get health metrics for specified positions
- `POST /liquidation-alerts` — Filter positions near liquidation risk

## Deployment URL
https://lending-liq-sentinel.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Fires alerts before health factor drops below 1.0
- ✅ Accurate liquidation price calculations
- ✅ Multi-protocol support (Aave V3, Compound V3)
- ✅ Supports any EVM wallet address
- ✅ x402-compatible endpoint deployed on live domain

## Payment Address
USDC (Base): `0x...`
Solana: `...`
