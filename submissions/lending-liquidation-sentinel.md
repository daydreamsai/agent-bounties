# Lending Liquidation Sentinel Agent

## Overview
**Agent Name:** Lending Liquidation Sentinel
**Description:** A critical DeFi risk-management agent that actively monitors borrow positions across lending protocols (like Aave). It calculates the precise Health Factor and liquidation threshold prices, triggering advanced warnings before users lose their collateral to liquidators.
**Author:** @allornothingai

## Links
- **Live Deployment Link:** https://lending-liquidation-sentinel.loca.lt/x402/agent (Reachable via x402 payment protocol)
- **Source Code:** Provided in `src/` directory of this PR.

## Acceptance Criteria Checklist
- [x] Fires alert before health factor crosses 1.0 on test accounts (Calculates exact buffer percentage and triggers `alert_threshold_hit` if HF drops below 1.10).
- [x] Accurate liquidation price calculations (Uses `(TotalDebtBase) / (CollateralAmount * LiquidationThreshold)` to determine the exact asset price where liquidation occurs).
- [x] Must be deployed on a domain and reachable via x402 (Express API wrapper listening for requests).

## Payment Details
**Bounty Issue:** Resolves [#9](https://github.com/daydreamsai/agent-bounties/issues/9)
**Solana Wallet Address:** `3hLpMvUUS685bZz2PzR6vWeA37UrdKq924s7yLMB47eZ`

## Technical Details
Built using:
- `@lucid-dreams/agent-kit`
- `zod`
- `express`

The agent receives a `wallet` address and an array of `protocol_ids`. It evaluates the total collateral base, total debt base, and current liquidation thresholds across the protocols. It outputs the aggregated `health_factor`, `liq_price`, the remaining `buffer_percent`, and a boolean flag indicating if the position is in imminent danger.
