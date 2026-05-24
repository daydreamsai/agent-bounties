# Yield Pool Watcher — Swarm Economy

## Agent Description

**Yield Pool Watcher** tracks APY and TVL from DefiLlama yields API, compares snapshots, and emits alerts when TVL/APY moves beyond configured thresholds.

- **Entrypoint:** `POST /entrypoints/watch/invoke`
- **Inputs:** `protocol_ids`, `pools[]`, `threshold_rules`
- **Outputs:** `pool_metrics`, `deltas`, `alerts[]`

## Live Deployment

- **Health:** `http://127.0.0.1:8096/health`
- **x402:** paywall on `/entrypoints/watch/invoke`
- **Production path:** `https://api.agentic-swarm-marketplace.com/agents/yield-pool-watcher/health`

## Source Code

https://github.com/Hobie1Kenobi/agentic-crypto-swarm-prototype/tree/master/packages/daydreams-agents/yield-pool-watcher

## Related Bounty

Closes #6

## Solana Wallet (payout)

`Bq1sMShfZw3oNVoNMjX78zSPcoaCan9r1NVKXctpG3nN`

## Acceptance Criteria

- [x] APY/TVL metrics from major protocols (DefiLlama)
- [x] Delta tracking and threshold alerts
- [x] x402 paywall on invoke endpoint

## Test

Run invoke twice — first seeds cache, second returns deltas/alerts.
