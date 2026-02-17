# Lending Liquidation Sentinel

## Description

An agent built with `@lucid-dreams/agent-kit` that monitors DeFi lending positions on Aave V3 and warns before liquidation risk. It fetches real on-chain data from the Aave V3 subgraph (with RPC fallback) and provides health factor monitoring, liquidation price calculations, position overviews, and structured alerts with severity levels.

## Related Bounty

Closes #9

## Source Code

https://github.com/tysoncung/lending-liquidation-sentinel

## Entrypoints

| Entrypoint | Description |
|---|---|
| `check-health-factor` | Check a wallet's health factor on Aave V3 |
| `calculate-liquidation-price` | Calculate liquidation prices for collateral positions |
| `monitor-positions` | Full position monitoring with health factor, liquidation prices, and alerts |
| `generate-alert` | Generate structured liquidation risk alerts with severity levels |

## Features

- Real on-chain data from Aave V3 (subgraph + RPC fallback)
- Health factor monitoring with configurable thresholds
- Liquidation price calculation per collateral asset
- Three severity levels: Critical (HF < 1.1), Warning (HF < 1.5), Info (custom threshold)
- Recommended actions based on risk level
- DeFi Llama protocol data integration
- x402 payment support via agent-kit
- Docker deployment ready

## Tech Stack

- `@lucid-dreams/agent-kit` — Agent framework with x402 support
- Aave V3 Subgraph (The Graph) — Position data
- Aave V3 Pool Contract (eth_call) — RPC fallback
- DeFi Llama API — Protocol TVL data
- Hono — HTTP server
