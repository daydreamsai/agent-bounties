# Slippage Sentinel

Estimate safe slippage tolerance for token swaps based on real-time market conditions, pool depth, and price impact.

## Description

Slippage Sentinel analyzes liquidity pool depth and price impact to recommend optimal slippage tolerance for DEX swaps. Helps traders avoid failed transactions and prevent excessive value loss.

## Entrypoints

- `GET /slippage?tokenA=<mint>&tokenB=<mint>&amount=<lamports>` — Get recommended slippage
- `GET /health` — Health check endpoint

## Acceptance Criteria

- ✅ Analyzes pool depth and liquidity for the swap pair
- ✅ Factors in price impact from Jupiter quotes
- ✅ Returns recommended slippage percentage with confidence level
- ✅ Exposed via x402 payment protocol
- ✅ Deployed on a public domain

## Tech Stack

- TypeScript + `@lucid-dreams/agent-kit`
- Jupiter API for pool data and swap quotes
