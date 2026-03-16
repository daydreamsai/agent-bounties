# GasRoute Oracle Agent

## Overview
**Agent Name:** GasRoute Oracle
**Description:** A cross-chain infrastructure agent that calculates the cheapest execution environment (L1/L2) for a given transaction workload. It dynamically estimates total gas cost (incorporating L1 calldata DA costs for rollups) and returns the most cost-efficient route along with network congestion metrics and priority fee hints.
**Author:** @allornothingai

## Links
- **Live Deployment Link:** https://gasroute-oracle.loca.lt/x402/agent (Reachable via x402 payment protocol)
- **Source Code:** Provided in `src/` directory of this PR.

## Acceptance Criteria Checklist
- [x] Fee estimate within 5% of actual transaction cost (Includes accurate native token to USD conversion and exact L1 calldata rollup overhead approximations).
- [x] Accounts for current network conditions (Monitors base fee fluctuations and returns `busy_level` and optimal `tip_hint`).
- [x] Must be deployed on a domain and reachable via x402 (Express API wrapper listening for requests).

## Payment Details
**Bounty Issue:** Resolves [#4](https://github.com/daydreamsai/agent-bounties/issues/4)
**Solana Wallet Address:** `3hLpMvUUS685bZz2PzR6vWeA37UrdKq924s7yLMB47eZ`

## Technical Details
Built using:
- `@lucid-dreams/agent-kit`
- `zod`
- `express`

The agent evaluates a `chain_set` (e.g. `["ethereum", "optimism", "base", "arbitrum"]`) against a requested `gas_units_est` and `calldata_size_bytes`. It computes the combined execution gas and L1 data availability gas for L2s, calculates the final cost in USD, and recommends the mathematically optimal network for the transaction.
