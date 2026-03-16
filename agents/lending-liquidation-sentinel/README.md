# Lending Liquidation Sentinel

Monitor borrow positions on lending protocols for liquidation risk. Alerts when positions approach dangerous health factor thresholds.

## Description

Tracks borrow positions across Marginfi and Solend. Calculates health factors in real-time and flags positions approaching liquidation thresholds.

## Entrypoints

- `GET /health-factor?wallet=<address>` — Check health factor for a wallet
- `GET /risk` — Risk level documentation
- `GET /health` — Health check endpoint

## Acceptance Criteria

- ✅ Monitors at least 2 lending protocols on Solana
- ✅ Calculates health factor and liquidation price
- ✅ Flags positions below configurable safety threshold
- ✅ Exposed via x402 payment protocol
- ✅ Deployed on a public domain

## Tech Stack

- TypeScript + `@lucid-dreams/agent-kit`
- Marginfi API, Solend API for lending data
