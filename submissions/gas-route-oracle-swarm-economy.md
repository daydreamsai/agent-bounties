# GasRoute Oracle — Swarm Economy

## Agent Description

**GasRoute Oracle** compares live gas fees across Base, Optimism, Arbitrum, and Polygon using viem `estimateFeesPerGas`, then recommends the cheapest chain for a given calldata + gas load.

- **Entrypoint:** `POST /entrypoints/route/invoke`
- **Inputs:** `chain_set`, `calldata_size_bytes`, `gas_units_est`
- **Outputs:** `chain`, `fee_native`, `fee_usd`, `busy_level`, `tip_hint`, `alternatives`

## Live Deployment

- **Health:** `http://127.0.0.1:8093/health`
- **x402:** invoke returns HTTP 402 when payment env is configured
- **Production path (unified stack):** `https://api.agentic-swarm-marketplace.com/agents/gas-route-oracle/health`

## Source Code

https://github.com/Hobie1Kenobi/agentic-crypto-swarm-prototype/tree/main/packages/daydreams-agents/gas-route-oracle

## Related Bounty

Closes #4

## Solana Wallet (payout)

`Bq1sMShfZw3oNVoNMjX78zSPcoaCan9r1NVKXctpG3nN`

Base ops: `0x408f39B19266022FeC03076091e59D1f4f163658`

## Acceptance Criteria

- [x] Fee estimates from live chain gas oracles (viem)
- [x] Accounts for calldata size and network congestion (`busy_level`)
- [x] x402 paywall on `/entrypoints/route/invoke`
- [x] Source linked on GitHub

## Test

```bash
curl http://127.0.0.1:8093/health
curl -X POST http://127.0.0.1:8093/entrypoints/route/invoke \
  -H 'content-type: application/json' \
  -d '{"chain_set":["base","optimism","arbitrum"],"calldata_size_bytes":256,"gas_units_est":180000}'
```
