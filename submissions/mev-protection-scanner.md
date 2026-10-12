# Submission: Bounty #45 — MEV Protection Scanner

Closes #45. Repo: https://github.com/aaron11998/mev-protection-scanner

## What it does

Cloudflare Worker AI agent that monitors the Ethereum mempool in real-time via WebSocket to detect MEV (Maximal Extractable Value) attacks before they execute. Scans pending transactions for sandwich attacks (front-run + back-run patterns) and front-running (high-gas competing transactions). Returns a risk assessment with protection strategies.

- **x402 payment protocol**: $0.01/call on Base USDC (`eip155:8453`), payTo `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
- **Real-time mempool monitoring**: WebSocket subscription to `newPendingTransactions` via Infura/Alchemy/Blocknative
- **Detection engine**: Sandwich attack detection (opposite-direction swaps around target), front-run detection (higher-gas competing swaps)
- **Response time**: <3 seconds target; simulated analysis <500ms
- **Protection suggestions**: Flashbots Protect RPC, slippage adjustments, MEV-Share, trade splitting

## Tests

**13/13 vitest green** across detection logic (sandwich, front-run, gas percentile, loss estimation), `tsc --noEmit` clean.

## Live endpoint — VERIFIED LIVE 2026-09-27

**URL (permanent account: Near Rosemary — same account as other submissions):**
https://mev-protection-scanner.near-rosemary.workers.dev

Fresh measurement evidence:
- `GET /health` → **200** `{"status":"degraded","mempoolConnected":false,"timestamp":...}` (mempool WS not configured in this deploy; returns mock result when no WS)
- `POST /scan` unpaid → **402** with full x402 payment requirements (exact scheme, Base USDC `0x833589fC…`, $0.01 `maxAmountRequired 10000`, payTo `0x76EfB727cd3271C7DE22f92437Be212766C9631f`)
- `GET /.well-known/x402.json` → **200** full x402 manifest

### Endpoints

- `GET /health` — free: status, mempool connection state
- `GET /.well-known/x402.json` — free: x402 payment manifest
- `POST /scan` — **x402 paid $0.01**: scan transaction for MEV risk

**Request body:**
```json
{
  "tokenIn": "0xA0b86a33E6441b8C4505B0e33B4A5d4D8F6c6d12",
  "tokenOut": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "amountIn": "1000000000000000000",
  "dex": "uniswap-v2",
  "gasPriceGwei": 25,
  "transactionHash": "0x..."
}
```

**Response:**
```json
{
  "riskScore": 85,
  "attackType": "sandwich",
  "estimatedLossUsd": 45.50,
  "protectionSuggestions": [
    "Use Flashbots Protect RPC (https://rpc.flashbots.net)",
    "Increase slippage tolerance to account for MEV",
    "Consider using MEV-blocking RPC like MEV-Share",
    "Split large trades into smaller chunks",
    "Use limit orders instead of market orders when possible"
  ],
  "competingTxs": 23,
  "gasPricePercentile": 35,
  "mempoolTxCount": 23,
  "analyzedTxHash": "0x...",
  "details": {
    "sandwichDetected": true,
    "frontRunDetected": false,
    "backRunDetected": true,
    "highGasCompetitors": 3,
    "avgCompetitorGasGwei": 35.2
  },
  "timestamp": 1790476115016
}
```

## Payout wallet

Solana: `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`

## Repo

https://github.com/aaron11998/mev-protection-scanner — TypeScript, Hono + x402-hono, 13 tests, mempool WebSocket monitoring with auto-reconnect.