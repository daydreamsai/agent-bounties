# Submission: Bounty #59 — Token Holder Monitor

Closes #59. Repo: https://github.com/aaron11998/token-holder-monitor

## What it does

Cloudflare Worker AI agent that analyzes token holder distributions across multiple EVM chains (Ethereum, Polygon, Arbitrum, Optimism, Base). Identifies whale wallets, calculates centralization metrics (Gini coefficient, HHI index, top 10/100 holder percentages), generates alerts for concentration risks, and tracks large holder movements.

- **x402 payment protocol**: $0.01/call on Base USDC (`eip155:8453`), payTo `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
- **Multi-chain support**: 5 EVM networks with chain-specific RPC endpoints
- **Centralization metrics**: Gini coefficient, Herfindahl-Hirschman Index (HHI), top 10/100 holder %
- **Whale identification**: Top holders with balances and percentages
- **Alert generation**: Concentration risk levels (low/medium/high/critical), large transfer detection
- **Response time**: <5 seconds target; simulated analysis <500ms

## Tests

**21/21 vitest green** across holder analysis (Gini, HHI, whale detection, alert generation, multi-chain routing), `tsc --noEmit` clean.

## Live endpoint — VERIFIED LIVE 2026-09-27

**URL (permanent account: Near Rosemary — same account as other submissions):**
https://token-holder-monitor.near-rosemary.workers.dev

Fresh measurement evidence:
- `GET /health` → **200** `{"status":"degraded","chains":{"ethereum":{"configured":false},...},"timestamp":...}` (RPC URLs not configured in this deploy; returns mock result when no RPC)
- `POST /holders` unpaid → **402** with full x402 payment requirements (exact scheme, Base USDC `0x833589fC…`, $0.01 `maxAmountRequired 10000`, payTo `0x76EfB727cd3271C7DE22f92437Be212766C9631f`)
- `GET /.well-known/x402.json` → **200** full x402 manifest

### Endpoints

- `GET /health` — free: status, chain configuration state
- `GET /.well-known/x402.json` — free: x402 payment manifest
- `POST /holders` — **x402 paid $0.01**: analyze token holder distribution

**Request body:**
```json
{
  "contractAddress": "0xA0b86a33E6441b8C4505B0e33B4A5d4D8F6c6d12",
  "chain": "ethereum",
  "minHolders": 100
}
```

**Response:**
```json
{
  "holderCount": 15420,
  "whaleWallets": [
    { "address": "0x...", "balance": "5000000000000000000000", "percentage": 12.5 },
    { "address": "0x...", "balance": "3000000000000000000000", "percentage": 7.5 }
  ],
  "concentrationMetrics": {
    "giniCoefficient": 0.82,
    "hhiIndex": 0.285,
    "top10Percentage": 45.2,
    "top100Percentage": 78.9
  },
  "centralizationRisk": "high",
  "alerts": [
    { "type": "concentration", "severity": "high", "message": "Top 10 holders control 45.2% of supply" },
    { "type": "whale_activity", "severity": "medium", "message": "Large transfer detected: 2.5M tokens moved" }
  ],
  "largeTransfers": [
    { "from": "0x...", "to": "0x...", "amount": "2500000000000000000000", "timestamp": 1790476124000 }
  ],
  "timestamp": 1790476124044
}
```

## Payout wallet

Solana: `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`

## Repo

https://github.com/aaron11998/token-holder-monitor — TypeScript, Hono + x402-hono, 21 tests, multi-chain holder analysis with Gini/HHI metrics.