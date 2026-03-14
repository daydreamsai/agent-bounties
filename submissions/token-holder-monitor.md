# Token Holder Monitor

## Agent Description
Monitor token holder distributions, track whale wallets, and generate alerts for centralization risks across multiple blockchain networks.

## Bounty Issue
Closes #59

## Live Deployment
- **URL:** http://65.108.87.255:8085
- **Entrypoints:** `GET /entrypoints` | `POST /entrypoints/analyze_holders/invoke`
- **Health:** `GET /health`

## Features
- Analyzes ERC-20 token holder distributions across Ethereum, Polygon, Arbitrum, Optimism, Base
- Computes Gini coefficient, HHI index, top-10/100 concentration percentages
- Identifies whale wallets and their percentage holdings
- Classifies centralization risk: `low`, `medium`, `high`, `critical`
- Generates actionable alerts for unusual holder patterns
- Tracks recent large transfers

## Example Usage
```bash
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

## Response Schema
```json
{
  "contract_address": "0x...",
  "chain": "ethereum",
  "token_name": "USD Coin",
  "token_symbol": "USDC",
  "total_supply": 42000000000,
  "holder_count": 20,
  "whale_wallets": [
    {
      "address": "0x...",
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
  "alerts": ["Whale alert: 0x3041Ca... holds 2.4% of supply"],
  "large_transfers": [],
  "fetched_at": "2026-03-14T20:00:00.000Z"
}
```

## Supported Chains
- `ethereum` (mainnet)
- `polygon`
- `arbitrum`
- `optimism`
- `base`

## Solana Wallet (for bounty payment)
`o27qQ458k5zVp4P3ajtn1ksu6d5xcvBTM5KYpCmbhYP`

## Technology Stack
- TypeScript + `@lucid-dreams/agent-kit`
- Moralis API (primary) + Etherscan API (fallback) for holder data
- x402 payment middleware integrated
- Deployed on Linux VPS (65.108.87.255)
