# Lending Liquidation Sentinel

## Overview

Monitors borrow positions on Aave V3 and warns before liquidation risk. Reads on-chain health factors directly from the Aave V3 Pool contract on Base and Ethereum.

## How It Works

1. **Chain Resolution** — Selects the appropriate Aave V3 Pool contract address based on the requested chain (Base or Ethereum mainnet)
2. **Account Data Query** — Calls `getUserAccountData(address)` on the Aave V3 Pool contract via viem, returning totalCollateralBase, totalDebtBase, healthFactor, and liquidation threshold
3. **Health Factor Decode** — Aave returns health factor as an 18-decimal uint256; the agent converts to human-readable format (1.0 = liquidation boundary)
4. **Risk Assessment** — Computes buffer percentage above liquidation, estimates the collateral price drop that would trigger liquidation
5. **Alert Evaluation** — Fires alert when health factor drops below the configured threshold (default 1.5)

## Entrypoints

### `monitor`
Check lending position health for a wallet.

**Input:**
- `wallet` — Wallet address to monitor
- `protocol_ids` — Lending protocols to check (e.g. `["aave_v3"]`)
- `alert_threshold` — Health factor threshold to trigger alert (default: 1.5)

**Output:**
- `wallet` — Monitored wallet address
- `positions[]` — Per-protocol position data:
  - `protocol_id` — Protocol identifier (e.g. `"aave_v3"`)
  - `chain` — Chain name
  - `health_factor` — Current health factor (1.0 = liquidation)
  - `total_collateral_usd` — Total collateral value in USD
  - `total_debt_usd` — Total debt value in USD
  - `available_borrows_usd` — Remaining borrow capacity in USD
  - `ltv_bps` — Current loan-to-value ratio in basis points
  - `liquidation_threshold_bps` — Liquidation threshold in basis points
  - `liq_price` — Collateral price drop ratio that triggers liquidation
  - `buffer_percent` — Safety buffer percentage above liquidation
  - `risk_level` — Risk classification: `SAFE`, `WARNING`, `DANGER`, or `LIQUIDATABLE`
  - `alert_threshold_hit` — Boolean, true when health factor is below alert threshold
  - `timestamp` — ISO 8601 timestamp of the check
- `health_factor` — Worst health factor across all positions (`null` if no data)
- `liq_price` — Worst liquidation price ratio (`null` if no data)
- `buffer_percent` — Worst buffer percentage (`null` if no data)
- `alert_threshold_hit` — Boolean, true if any position triggered an alert
- `summary` — Human-readable summary of the position status

### `health`
Quick health factor check for a single wallet on a single protocol. Returns current risk level and liquidation metrics including `health_factor`, `risk_level`, `liq_price`, `buffer_percent`, `total_collateral_usd`, and `total_debt_usd`.

## Supported Protocols

- **Aave V3 on Base** — Pool: `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`
- **Aave V3 on Ethereum** — Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`

## Tech Stack

- **Runtime:** Node.js / Bun with TypeScript
- **On-chain:** viem for direct smart contract reads (no subgraph dependency)
- **Framework:** @lucid-dreams/agent-kit with x402 payment middleware

## Deployment

```bash
cd submissions/lending-liquidation-sentinel
npm install
ADDRESS=0xYourWallet NETWORK=base-sepolia tsx src/index.ts
```
