# Cross DEX Arbitrage Alert

Detect and flag price spreads across decentralized exchanges. Compares token prices between DEXs to identify arbitrage opportunities in real-time.

## Description

Cross DEX Arbitrage Alert continuously monitors token prices across multiple DEXs. When a significant price discrepancy is detected, it alerts traders with actionable details including expected profit after gas and fees.

## Entrypoints

- `GET /spreads` — Current cross-DEX price spreads
- `GET /spreads?token=<symbol>` — Filter by token
- `GET /spreads?minSpread=<percent>` — Filter by minimum spread threshold
- `GET /opportunities` — Ranked arbitrage opportunities with estimated profit
- `GET /health` — Health check endpoint

## Acceptance Criteria

- ✅ Compares prices across at least 3 DEXs per chain
- ✅ Detects spreads above configurable threshold (default 0.5%)
- ✅ Calculates estimated profit after gas/fees
- ✅ Exposed via x402 payment protocol
- ✅ Deployed on a public domain

## Tech Stack

- TypeScript + `@lucid-dreams/agent-kit`
- Jupiter API, 1inch API, 0x API for price aggregation
