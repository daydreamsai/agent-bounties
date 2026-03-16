# LP Impermanent Loss Estimator

Calculate impermanent loss and fee APR for liquidity provider positions across AMM protocols.

## Description

Computes current and projected impermanent loss for LP positions, factoring in fee earnings, price divergence, and time in pool.

## Entrypoints

- `GET /il?tokenA=<mint>&tokenB=<mint>&entryPriceA=<num>&entryPriceB=<num>` — Calculate IL
- `GET /il/position?pool=<address>` — Analyze existing pool position
- `GET /health` — Health check endpoint

## Acceptance Criteria

- ✅ Calculates impermanent loss percentage from entry to current price
- ✅ Estimates fee APR based on pool volume and TVL
- ✅ Projects IL at various price divergence levels
- ✅ Exposed via x402 payment protocol
- ✅ Deployed on a public domain

## Tech Stack

- TypeScript + `@lucid-dreams/agent-kit`
- Raydium and Jupiter APIs for pool data
