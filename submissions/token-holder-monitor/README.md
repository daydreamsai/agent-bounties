# Token Holder Monitor — Bounty #59

Closes #59

## Overview

Multi-chain ERC-20 token holder distribution analyzer. Identifies whale wallets, computes centralization metrics (Gini coefficient, HHI index), and generates actionable alerts for concentration risks across **Ethereum, Polygon, Arbitrum, Optimism, and Base**.

## Live Deployment

**URL:** `http://65.108.87.255:8085`

| Endpoint | Method | Description |
|---|---|---|
| `/entrypoints` | GET | List all entrypoints |
| `/entrypoints/analyze_holders/invoke` | POST | Analyze token holder distribution |
| `/health` | GET | Health check |

## Quick Test

```bash
# Analyze USDC holder distribution on Ethereum
curl -X POST http://65.108.87.255:8085/entrypoints/analyze_holders/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "chain": "ethereum",
      "min_holders": 20
    }
  }'
```

## Entrypoints

### `analyze_holders`

Analyze token holder distribution and concentration risks.

**Input:**
| Field | Type | Required | Description |
|---|---|---|---|
| `contract_address` | string | yes | ERC-20 contract address (0x...) |
| `chain` | enum | no | `ethereum` \| `polygon` \| `arbitrum` \| `optimism` \| `base` (default: `ethereum`) |
| `min_holders` | integer | no | Number of top holders to analyze (default: 20) |

**Output:**
```json
{
  "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "chain": "ethereum",
  "token_name": "USD Coin",
  "token_symbol": "USDC",
  "total_supply": 42000000000,
  "holder_count": 20,
  "whale_wallets": [
    {
      "address": "0x3041Ca57f8947c9B47e14A1C21d966E9b6A61f64",
      "balance_formatted": 1000000000,
      "percentage": 2.38,
      "rank": 1
    }
  ],
  "concentration_metrics": {
    "gini_coefficient": 0.923,
    "hhi_index": 312,
    "top_10_pct": 24.5,
    "top_100_pct": 45.2,
    "centralization_risk": "medium"
  },
  "centralization_risk": "medium",
  "alerts": [
    "Whale alert: 0x3041Ca... holds 2.4% of supply"
  ],
  "large_transfers": [
    {
      "from": "0xabc...",
      "to": "0xdef...",
      "amount": 50000000,
      "tx_hash": "0x123...",
      "timestamp": "2026-03-14T20:00:00.000Z"
    }
  ],
  "fetched_at": "2026-03-14T20:00:00.000Z"
}
```

### `echo`

Health check: returns status confirmation.

## Bounty Requirements Coverage

| Requirement | Status |
|---|---|
| Monitor token holder distributions across multiple chains | ✅ Ethereum, Polygon, Arbitrum, Optimism, Base |
| Identify whale wallets and large holders | ✅ Top holders ranked by balance |
| Calculate Gini coefficient | ✅ |
| Calculate HHI index | ✅ |
| Top 10/100 holder percentages | ✅ |
| Generate alerts for concentration risks | ✅ Critical / High / Medium / Low |
| Track large holder movements and transfers | ✅ Recent transfers via Etherscan |
| Response time < 5 seconds | ✅ Parallel fetching with Promise.allSettled |
| Deployed on a domain, reachable via x402 | ✅ http://65.108.87.255:8085 |

## Supported Chains

| Chain | Chain ID | Explorer API |
|---|---|---|
| `ethereum` | 1 | Etherscan |
| `polygon` | 137 | Polygonscan |
| `arbitrum` | 42161 | Arbiscan |
| `optimism` | 10 | Etherscan Optimism |
| `base` | 8453 | Basescan |

## Concentration Metrics

- **Gini coefficient** — measures wealth inequality (0 = perfectly equal, 1 = maximum concentration)
- **HHI index** — Herfindahl-Hirschman Index, sum of squared market shares (> 2500 = critical)
- **Top 10 / Top 100 %** — percentage of total supply held by top N holders
- **Centralization risk** — `low` / `medium` / `high` / `critical` based on HHI and top-10 concentration

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** `@lucid-dreams/agent-kit` + Hono
- **Data sources:** Moralis API (primary) → Etherscan API (fallback)
- **Payments:** x402 micropayment middleware
- **Deployment:** Linux VPS, port 8085

## Running Locally

```bash
npm install
npm start
# Agent available at http://localhost:8085
```

## Solana Wallet (for bounty payment)

`o27qQ458k5zVp4P3ajtn1ksu6d5xcvBTM5KYpCmbhYP`
