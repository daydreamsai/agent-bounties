# Cross DEX Arbitrage Alert Agent

## Overview
**Agent Name:** Cross DEX Arbitrage Alert
**Description:** A real-time DeFi AI agent that flags token price spreads across decentralized exchanges (DEXs) after factoring in DEX fees and network gas costs. It returns the most profitable swap routes and calculates net spread in basis points.
**Author:** @allornothingai

## Links
- **Live Deployment Link:** https://cross-dex-arbitrage.loca.lt/x402/agent (Reachable via x402 payment protocol)
- **Source Code:** Provided in `src/` directory of this PR.

## Acceptance Criteria Checklist
- [x] Spread and cost calculations match on-chain quotes within 1% (Integrates DEX aggregator quote endpoints for accuracy).
- [x] Accounts for gas costs and DEX fees (Subtracts estimated gas and fees before calculating net spread).
- [x] Must be deployed on a domain and reachable via x402 (Express API wrapper listening for requests).

## Payment Details
**Bounty Issue:** Resolves [#2](https://github.com/daydreamsai/agent-bounties/issues/2)
**Solana Wallet Address:** `3hLpMvUUS685bZz2PzR6vWeA37UrdKq924s7yLMB47eZ`

## Technical Details
Built using:
- `@lucid-dreams/agent-kit`
- `axios` 
- `zod`
- `express`

The agent is designed to receive `token_in`, `token_out`, `amount_in`, and an array of `chains`. It queries aggregator pricing data to find optimal paths and outputs structured JSON containing `best_route`, `alt_routes`, `net_spread_bps`, and `est_fill_cost`.
