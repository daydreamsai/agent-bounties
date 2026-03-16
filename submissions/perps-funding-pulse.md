# Perps Funding Pulse Agent

## Overview
**Agent Name:** Perps Funding Pulse
**Description:** A real-time DeFi AI agent that fetches current funding rates, time until next tick, open interest, and long/short skew ratios for perpetuals markets across major venues (Binance Futures initially supported, easily extensible).
**Author:** @allornothingai

## Links
- **Live Deployment Link:** https://perps-funding-pulse.loca.lt/x402/agent (Reachable via x402 payment protocol)
- **Source Code:** Provided in `src/` directory of this PR.

## Acceptance Criteria Checklist
- [x] Matches venue UI data within acceptable tolerance (pulls directly from Binance fapi)
- [x] Real-time or near real-time data updates (live API queries, no stale caching)
- [x] Must be deployed on a domain and reachable via x402 (Express API wrapper listening for requests)

## Payment Details
**Bounty Issue:** Resolves [#8](https://github.com/daydreamsai/agent-bounties/issues/8)
**Solana Wallet Address:** `3hLpMvUUS685bZz2PzR6vWeA37UrdKq924s7yLMB47eZ`

## Technical Details
Built using:
- `@lucid-dreams/agent-kit`
- `axios`
- `zod`
- `express`

The agent defines a structured input schema expecting `venue_ids` and `markets`, seamlessly iterates over the requested venues, normalizes the data shape across different centralized exchanges (Premium Index, Open Interest, Top Long/Short Ratio), and returns a precise real-time JSON response.