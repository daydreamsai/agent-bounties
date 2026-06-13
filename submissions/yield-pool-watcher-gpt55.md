# Yield Pool Watcher

## Related Bounty

Issue: #6 - Yield Pool Watcher

## Agent

Implementation path: `submissions/yield-pool-watcher`

The agent monitors DeFi yield pool APY and TVL from DefiLlama, computes deltas from DefiLlama chart data or service memory snapshots, and emits threshold-based alerts for APY spikes/drops and TVL drains/spikes.

## Inputs

- `protocol_ids`: DefiLlama project IDs to monitor, such as `aave-v3`, `curve-dex`, or `uniswap-v3`
- `pools[]`: optional exact DefiLlama pool IDs
- `threshold_rules`: TVL/APY alert thresholds
- optional `limit`
- optional `include_charts`

## Outputs

- `pool_metrics`: current APY, TVL, chain, project, symbol, IL risk, exposure, token metadata, predictions
- `deltas`: TVL/APY deltas with source labels
- `alerts[]`: threshold-triggered alerts
- `warnings[]`
- `data_sources[]`

## Accuracy Notes

This implementation uses real DefiLlama yield data. It does not fabricate per-block updates. Delta source is explicit per pool:

- `defillama_chart`: latest chart point compared to previous chart point
- `service_memory`: current request compared to this service's prior observed snapshot
- `none`: first observation and no chart baseline available

That makes the freshness boundary visible while still supporting rapid alerting when the data provider updates or repeat polling observes a change.

## Validation

```bash
cd submissions/yield-pool-watcher
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Current local validation:

- npm run build passes
- npm test passes 5 tests
- npm run lint passes
- npm audit --audit-level=moderate reports 0 vulnerabilities
- live sample against Aave v3 returned real DefiLlama pool metrics, TVL/APY values, chart deltas, and no warnings

Tests cover:

- percent and absolute delta calculations
- TVL drop, APY spike, and APY absolute-change alerts
- minimum TVL filter behavior
- input schema defaults and rejection cases

## Deployment / x402

The implementation includes an Express server with `@x402/express` protection for:

- `POST /entrypoints/watch_yield_pools/invoke`
- `POST /entrypoints/yield-pools/invoke`
- `POST /entrypoints/pools/invoke`
- `POST /invoke`

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/yield-pool-watcher`
- Health: `https://gpt55.558686.xyz/yield-pool-watcher/health`
- Manifest: `https://gpt55.558686.xyz/yield-pool-watcher/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/yield-pool-watcher/entrypoints/watch_yield_pools/invoke`
- Hyphenated alias: `POST https://gpt55.558686.xyz/yield-pool-watcher/entrypoints/yield-pools/invoke`
- Short alias: `POST https://gpt55.558686.xyz/yield-pool-watcher/entrypoints/pools/invoke`
- Legacy alias: `POST https://gpt55.558686.xyz/yield-pool-watcher/invoke`

Public x402 smoke validation returned HTTP 402 with `PAYMENT-REQUIRED` for all four invoke paths. The deployed manifest advertises Base x402 (`eip155:8453`) at `$0.01` per request.

Observed service cost on the Beijing server after startup: about 72 MB RSS, with negligible idle CPU after the Node process is warm.

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`