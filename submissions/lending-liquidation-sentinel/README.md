# Lending Liquidation Sentinel

**Bounty:** [Daydreams Agent Bounties #9](https://github.com/daydreamsai/agent-bounties/issues/9)

## Purpose

Monitors borrow positions on Aave v3, Compound v3, and Morpho Blue. Tracks health factor in real-time and fires alerts before HF approaches 1.0 (liquidation threshold).

## Features

- **Aave v3:** On-chain `getUserAccountData()` via `eth_call` — exact health factor, collateral, debt, liquidation threshold
- **Compound v3:** `isLiquidatable()` + `borrowBalanceOf()` via on-chain RPC
- **Morpho Blue:** GraphQL API (`blue-api.morpho.org`) — per-market health factor, LLTV, collateral/borrow breakdown
- **Alert levels:** Safe (≥2.0) → Warning (≥1.5) → Danger (≥1.1) → Critical (<1.1)
- **Buffer percent:** How much collateral can drop before liquidation: `(1 - 1/HF) × 100`
- **Liquidation simulator:** Model HF impact of collateral price drops without on-chain calls

## Actions

| Action | Description |
|--------|-------------|
| `check_position` | Check health factor and alerts for a wallet |
| `simulate_liquidation` | Simulate HF at various collateral price drops |
| `echo` | Health check |

## Usage

```bash
npm install
npm start
```

Server starts on port **8095** by default.

### Example — Check Aave Position

```bash
curl -X POST http://localhost:8095/invoke/check_position \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "protocol_ids": ["aave-v3", "morpho"],
      "chain": "ethereum",
      "alert_threshold": 1.3
    }
  }'
```

### Example — Simulate Liquidation Scenarios

```bash
curl -X POST http://localhost:8095/invoke/simulate_liquidation \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "health_factor": 1.45,
      "collateral_usd": 50000,
      "debt_usd": 30000,
      "liquidation_threshold": 0.825,
      "price_drop_pcts": [10, 20, 30, 40, 50]
    }
  }'
```

## Response Format (check_position)

```json
{
  "wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "chain": "ethereum",
  "alert_threshold": 1.3,
  "worst_health_factor": 1.45,
  "any_alert": false,
  "positions": [
    {
      "protocol": "aave-v3",
      "chain": "ethereum",
      "health_factor": 1.45,
      "liq_price": 41250.00,
      "collateral_usd": 50000,
      "debt_usd": 28500,
      "buffer_percent": 31.03,
      "alert_threshold_hit": false,
      "alert_level": "warning",
      "alert_message": "⚠️ WARNING — health factor 1.4500 approaching danger zone."
    }
  ],
  "summary": "✅ Safe. Worst HF: 1.4500"
}
```

## Alert Levels

| Level | Health Factor | Meaning |
|-------|--------------|---------|
| `safe` | ≥ 2.0 | Low risk |
| `warning` | 1.5 – 2.0 | Monitor closely |
| `danger` | 1.1 – 1.5 | Add collateral or repay debt |
| `critical` | < 1.1 | Liquidation imminent |

## Data Sources

| Protocol | Method |
|----------|--------|
| Aave v3 | On-chain `eth_call` → `Pool.getUserAccountData()` via LlamaRPC |
| Compound v3 | On-chain `eth_call` → `Comet.isLiquidatable()` + `borrowBalanceOf()` |
| Morpho Blue | GraphQL API `blue-api.morpho.org` — per-market HF + USD values |

## Supported Chains

- Ethereum, Arbitrum, Polygon, Optimism, Base, Avalanche

## Tech Stack

- TypeScript + Node.js
- On-chain RPC via LlamaRPC (no API key needed)
- Morpho GraphQL API
- [Lucid Dreams Agent Kit](https://github.com/daydreamsai/lucid-agents)

## Solana Wallet

`HtCYXQBT2EVMqVrkz3a7M9EFQqg6tKnqe9bDJgQ7sXdZ`
