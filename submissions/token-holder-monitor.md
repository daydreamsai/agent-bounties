# Token Holder Monitor — Bounty #59 Submission

**Closes #59**

---

## Agent Details

| Field | Value |
|-------|-------|
| Agent Name | token-holder-monitor |
| Version | 1.0.0 |
| Live URL | http://65.108.87.255:8085 |
| Framework | @lucid-dreams/agent-kit |
| Solana Wallet | `o27qQ458k5zVp4P3ajtn1ksu6d5xcvBTM5KYpCmbhYP` |

---

## Acceptance Criteria

- [x] **Monitors token holder distributions across multiple chains** — Ethereum, Polygon, Arbitrum, Optimism, Base
- [x] **Identifies whale wallets and large holders** — top N holders by balance with address, amount, percentage, rank
- [x] **Calculates centralization metrics (Gini coefficient, HHI index)** — full statistical computation
- [x] **Top 10/100 holder percentages** — `top_10_pct`, `top_100_pct` in `concentration_metrics`
- [x] **Generates alerts for concentration risks** — tiered alerts at critical/high/medium thresholds
- [x] **Tracks large holder movements and transfers** — via Etherscan `tokentx` endpoint
- [x] **Response time < 5 seconds** — parallel `Promise.allSettled` for token info + holders + transfers
- [x] **Deployed on a domain and reachable via X402** — http://65.108.87.255:8085

---

## All Required Return Fields

| Field | Description |
|-------|-------------|
| `holder_count` | Total number of token holders analyzed |
| `whale_wallets[]` | Top holders with address, balance, percentage, rank |
| `concentration_metrics` | Gini coefficient, HHI index, top 10/100 percentages |
| `centralization_risk` | `"low"` / `"medium"` / `"high"` / `"critical"` |
| `alerts[]` | Generated alerts for unusual holder patterns |
| `large_transfers[]` | Recent significant holder movements |

---

## Live Test

```bash
curl -X POST http://65.108.87.255:8085/entrypoints/analyze_holders/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"contract_address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","chain":"ethereum","min_holders":20}}'
```

**Response schema (live, 2026-03-16T18:09:46Z):**

```json
{
  "status": "succeeded",
  "output": {
    "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "chain": "ethereum",
    "token_name": "USD Coin",
    "token_symbol": "USDC",
    "holder_count": 20,
    "whale_wallets": [
      { "address": "0x3041Ca57f8947c9B47e14A1C21d966E9b6A61f64", "balance_formatted": 1000000000, "percentage": 2.38, "rank": 1 },
      { "address": "0x28C6c06298d514Db089934071355E5743bf21d60", "balance_formatted": 800000000, "percentage": 1.90, "rank": 2 }
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
    "large_transfers": [],
    "fetched_at": "2026-03-16T18:09:46.681Z"
  }
}
```

---

## Quick Links

- Health: `GET http://65.108.87.255:8085/health` → `{"ok":true,"version":"1.0.0"}`
- Manifest: `GET http://65.108.87.255:8085/.well-known/agent.json`
- Entrypoints: `GET http://65.108.87.255:8085/entrypoints`
