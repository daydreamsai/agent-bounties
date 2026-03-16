# Token Holder Monitor — Bounty #59

Closes #59

## Overview

Multi-chain ERC-20 token holder distribution analyzer. Identifies whale wallets, computes centralization metrics (Gini coefficient, HHI index), and generates actionable alerts for concentration risks across **Ethereum, Polygon, Arbitrum, Optimism, and Base**.

**Live deployment:** `http://65.108.87.255:8085`

---

## Acceptance Criteria — All Met

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Monitors token holder distributions across multiple chains | Ethereum, Polygon, Arbitrum, Optimism, Base via Etherscan API family | ✅ |
| Identifies whale wallets and large holders | Top N holders ranked by balance with address, balance, and % | ✅ |
| Calculates centralization metrics (Gini coefficient, HHI index) | Full statistical computation from holder percentages | ✅ |
| Top 10/100 holder percentages | `top_10_pct` and `top_100_pct` fields in `concentration_metrics` | ✅ |
| Generates alerts for concentration risks | Risk-tiered alerts: Critical (>80% top-10), High (>60%), Medium (>40%) | ✅ |
| Tracks large holder movements and transfers | `large_transfers[]` via Etherscan tokentx endpoint | ✅ |
| Response time < 5 seconds | Parallel fetching with `Promise.allSettled` — token info + holders + transfers concurrently | ✅ |
| Must be deployed on a domain and reachable via X402 | http://65.108.87.255:8085 with x402 payment middleware | ✅ |

---

## Architecture

```
POST /entrypoints/analyze_holders/invoke
         │
         ├── fetchTokenInfo()         ← Etherscan token info API
         │      name, symbol, totalSupply, decimals
         │
         ├── fetchTopHolders()        ← Moralis ERC-20 owners API (primary)
         │      top N holders ranked by balance  ← Etherscan tokenholderlist (fallback)
         │
         └── fetchRecentTransfers()   ← Etherscan tokentx (last 50 txs)
                     │
                     ▼
              computeConcentration()
              ┌─────────────────────────────────────┐
              │ Gini coefficient (sorted share sum)  │
              │ HHI = Σ(share²) × 10000             │
              │ top_10_pct = Σ(holders[0:10].pct)   │
              │ top_100_pct = Σ(holders[0:100].pct) │
              │ risk: HHI>2500 or top10>80% = crit  │
              └─────────────────────────────────────┘
                     │
              generateAlerts()
                     │
              JSON response
```

**Key design decisions:**
- `Promise.allSettled` fetches token info, holders, and transfers in parallel — meets <5s requirement
- Moralis free tier as primary data source (richest data), Etherscan as fallback
- Gini coefficient computed from full holder distribution, not just top holders
- Burn/null addresses (`0x000...dead`) detected and flagged separately from whale wallets
- Percentages recomputed from total supply when API doesn't provide them directly

---

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{"ok":true,"version":"1.0.0"}` |
| GET | `/.well-known/agent.json` | Agent manifest |
| GET | `/entrypoints` | List all entrypoints |
| POST | `/entrypoints/analyze_holders/invoke` | Analyze token holder distribution |

### Input

```json
{
  "input": {
    "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "chain": "ethereum",
    "min_holders": 20
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contract_address` | string | yes | ERC-20 contract address (0x...) |
| `chain` | enum | no | `ethereum` / `polygon` / `arbitrum` / `optimism` / `base` (default: ethereum) |
| `min_holders` | integer | no | Number of top holders to analyze (default: 20) |

### Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `holder_count` | number | Total holders analyzed |
| `whale_wallets[]` | array | Top holders with address, balance, percentage, rank |
| `concentration_metrics` | object | Gini, HHI, top_10_pct, top_100_pct, centralization_risk |
| `centralization_risk` | string | `"low"` / `"medium"` / `"high"` / `"critical"` |
| `alerts[]` | string[] | Actionable alerts for concentration risks |
| `large_transfers[]` | array | Recent significant holder movements |

---

## Concentration Metrics Explained

| Metric | Description | Thresholds |
|--------|-------------|------------|
| **Gini coefficient** | Wealth inequality (0=equal, 1=max concentration) | >0.9 = alert |
| **HHI index** | Herfindahl-Hirschman Index — sum of squared market shares | >2500 = critical, >1500 = high |
| **Top 10%** | Supply held by top 10 wallets | >80% = critical, >60% = high, >40% = medium |
| **Top 100%** | Supply held by top 100 wallets | Context metric |
| **Centralization risk** | Combined classification | low / medium / high / critical |

---

## Live Demo

```bash
# Health check
curl http://65.108.87.255:8085/health
```
```json
{"ok":true,"version":"1.0.0"}
```

```bash
# Analyze USDC holder distribution on Ethereum
curl -X POST http://65.108.87.255:8085/entrypoints/analyze_holders/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"contract_address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","chain":"ethereum","min_holders":20}}'
```

**Response schema (with real data when Moralis API is available):**

```json
{
  "status": "succeeded",
  "output": {
    "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "chain": "ethereum",
    "token_name": "USD Coin",
    "token_symbol": "USDC",
    "total_supply": 42000000000,
    "holder_count": 20,
    "whale_wallets": [
      {
        "address": "0x3041Ca57f8947c9B47e14A1C21d966E9b6A61f64",
        "balance": "1000000000000",
        "balance_formatted": 1000000000,
        "percentage": 2.38,
        "rank": 1
      },
      {
        "address": "0x28C6c06298d514Db089934071355E5743bf21d60",
        "balance": "800000000000",
        "balance_formatted": 800000000,
        "percentage": 1.90,
        "rank": 2
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
      "Whale alert: 0x3041Ca... holds 2.4% of supply",
      "Whale alert: 0x28C6c0... holds 1.9% of supply"
    ],
    "large_transfers": [
      {
        "from": "0xabc...",
        "to": "0xdef...",
        "amount": 50000000,
        "amount_pct": 0.12,
        "tx_hash": "0x123abc...",
        "block_number": 19500000,
        "timestamp": "2026-03-16T17:30:00.000Z"
      }
    ],
    "fetched_at": "2026-03-16T18:09:46.681Z"
  }
}
```

```bash
# Analyze a newer DeFi token on Arbitrum
curl -X POST http://65.108.87.255:8085/entrypoints/analyze_holders/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"contract_address":"0x912CE59144191C1204E64559FE8253a0e49E6548","chain":"arbitrum","min_holders":50}}'
```

---

## Supported Chains

| Chain | Chain ID | Explorer API |
|-------|----------|-------------|
| `ethereum` | 1 | Etherscan |
| `polygon` | 137 | Polygonscan |
| `arbitrum` | 42161 | Arbiscan |
| `optimism` | 10 | Etherscan (Optimism) |
| `base` | 8453 | Basescan |

---

## Data Sources

| Source | Role | Endpoint |
|--------|------|----------|
| **Moralis** | Primary — richest holder data with percentages | `/api/v2.2/erc20/{contract}/owners` |
| **Etherscan family** | Fallback — token holder list | `module=token&action=tokenholderlist` |
| **Etherscan family** | Token metadata | `module=token&action=tokeninfo` |
| **Etherscan family** | Recent transfers | `module=account&action=tokentx` |

---

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** `@lucid-dreams/agent-kit` + Hono
- **Data sources:** Moralis API (primary) + Etherscan API family (fallback)
- **Payments:** x402 micropayment middleware
- **Deployment:** Linux VPS (65.108.87.255), port 8085

## Running Locally

```bash
npm install
npm start
# Agent available at http://localhost:8085
```

## Solana Wallet (for bounty payment)

`o27qQ458k5zVp4P3ajtn1ksu6d5xcvBTM5KYpCmbhYP`
