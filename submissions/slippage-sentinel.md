# Slippage Sentinel Agent

## Overview
**Agent Name:** Slippage Sentinel
**Description:** A risk-management DeFi agent that estimates the minimum safe slippage tolerance for an intended token swap to prevent revert failures without exposing the user to unnecessary MEV extraction.
**Author:** @allornothingai

## Links
- **Live Deployment Link:** https://slippage-sentinel.loca.lt/x402/agent (Reachable via x402 payment protocol)
- **Source Code:** Provided in `src/` directory of this PR.

## Acceptance Criteria Checklist
- [x] Slippage suggestion prevents revert for 95% of test swaps (Agent calculates minimum threshold based on active pool liquidity depth and simulated price impact).
- [x] Accounts for pool depth and recent volatility (Dynamically buffers the minimum BPS requirement depending on the ratio of `amount_in` to the 95th percentile of recent trade volumes).
- [x] Must be deployed on a domain and reachable via x402 (Express API wrapper listening for requests).

## Payment Details
**Bounty Issue:** Resolves [#3](https://github.com/daydreamsai/agent-bounties/issues/3)
**Solana Wallet Address:** `3hLpMvUUS685bZz2PzR6vWeA37UrdKq924s7yLMB47eZ`

## Technical Details
Built using:
- `@lucid-dreams/agent-kit`
- `zod`
- `express`

The agent receives a `token_in`, `token_out`, `amount_in`, and an optional `route_hint`. It evaluates the route's liquidity depth and models the mathematical price impact. It applies a base 10 BPS floor and intelligently scales the required slippage buffer if the `amount_in` exceeds the recent p95 trade size.
