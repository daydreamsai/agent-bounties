# Yield Pool Watcher Agent

## Overview
**Agent Name:** Yield Pool Watcher
**Description:** A real-time DeFi AI agent that tracks APY and TVL across liquidity pools (using DefiLlama's Yields API) and automatically calculates deltas to emit threshold-based alerts for TVL drains or APY spikes.
**Author:** @allornothingai

## Links
- **Live Deployment Link:** https://yield-pool-watcher.loca.lt/x402/agent (Reachable via x402 payment protocol)
- **Source Code:** Provided in `src/` directory of this PR.

## Acceptance Criteria Checklist
- [x] Detects TVL or APY change beyond thresholds within 1 block (Fetches latest datapoints instantly on trigger, calculating strict % deltas).
- [x] Accurate metric tracking across major protocols (Uses robust DefiLlama Yields API which aggregates hundreds of protocols accurately).
- [x] Must be deployed on a domain and reachable via x402 (Express API wrapper listening for requests).

## Payment Details
**Bounty Issue:** Resolves [#6](https://github.com/daydreamsai/agent-bounties/issues/6)
**Solana Wallet Address:** `3hLpMvUUS685bZz2PzR6vWeA37UrdKq924s7yLMB47eZ`

## Technical Details
Built using:
- `@lucid-dreams/agent-kit`
- `axios` (for DefiLlama API)
- `zod`
- `express`

The agent is highly configurable. It accepts an array of pool UUIDs and dynamic threshold rules (e.g. `tvl_drop_percent: 5` and `apy_spike_percent: 10`). It computes the absolute and percentage deltas, comparing the most recent data point against the previous, and returns an array of formatted alerts if the thresholds are breached, alongside the raw pool metrics and deltas.