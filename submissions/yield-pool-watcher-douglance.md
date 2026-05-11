# Yield Pool Watcher

## Related Bounty

Issue: https://github.com/daydreamsai/agent-bounties/issues/6

## Description

Yield Pool Watcher monitors DeFi pool APY and TVL, compares current metrics to
recent historical snapshots, and emits threshold alerts for TVL drains/spikes
and APY moves.

The agent uses `@lucid-dreams/agent-kit` with x402 payments and DefiLlama's
official yield APIs for live pool metadata and historical APY/TVL charts.

## Live Deployment

- Agent: https://yield-pool-watcher.doug-lance.workers.dev
- Manifest: https://yield-pool-watcher.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `POST /entrypoints/watch-yield-pools/invoke`

## Source

- Repository: https://github.com/douglance/yield-pool-watcher
- Specification: https://github.com/douglance/yield-pool-watcher/blob/main/SPEC.md
- Deployment notes: https://github.com/douglance/yield-pool-watcher/blob/main/DEPLOY.md

## Supported Inputs

```json
{
  "protocol_ids": ["aave-v3", "compound-v3", "curve-dex"],
  "pools": [],
  "chains": ["Ethereum"],
  "threshold_rules": {
    "tvl_change_pct": 10,
    "apy_change_pct": 25,
    "apy_change_points": 5,
    "min_tvl_usd": 100000,
    "window_hours": 24,
    "max_pools": 10
  }
}
```

## Returns

- `pool_metrics`: current APY, TVL, chain, protocol, symbol, and risk metadata
- `deltas`: TVL and APY changes against the selected historical window
- `alerts`: threshold-triggered APY/TVL alerts with severity
- `data_sources`: DefiLlama current-pool and historical-chart endpoints
- `confidence`: based on selected pools and available historical samples

## Validation

Local validation:

```text
npm run build
npm test
npm run smoke:live
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Observed live checks:

```text
curl -fsS https://yield-pool-watcher.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://yield-pool-watcher.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes watch-yield-pools and x402/AP2 metadata

unpaid POST /entrypoints/watch-yield-pools/invoke
-> HTTP 402 with x402 payment requirements for base-sepolia
```

Direct live DefiLlama smoke returned 2 Aave V3 Ethereum pools, 3 threshold
alerts, and confidence 0.9.

## Solana Wallet

`EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
