# Yield Pool Watcher Agent

Track APY and TVL across DeFi pools and alert on sharp changes in metrics.

## Purpose

Monitor DeFi pool metrics from DefiLlama's yields API and emit alerts on significant TVL or APY changes. Supports filtering by protocol and pool, with configurable threshold rules.

## Entrypoints

### `watch` — Main monitoring endpoint

Fetches current pool metrics, computes deltas from previous state, and triggers alerts based on threshold rules.

**Input:**
- `protocol_ids` (optional, string[]) — DeFi protocols to monitor (e.g., `curve`, `aave`, `uniswap`)
- `pools` (optional, string[]) — Specific pools to watch by name or chain (e.g., `ethereum`)
- `threshold_rules` — Alert threshold configuration:
  - `metric` — `"tvlUsd"`, `"apy"`, or `"apyBase"`
  - `threshold_pct` — Change percentage to trigger alert (e.g., `10` = 10%)

**Returns:**
- `pool_metrics` — Top 20 pools by TVL with APY, chain, project
- `deltas` — TVL and APY changes from previous snapshot
- `alerts` — Triggered alerts with severity (`info`/`warning`/`critical`)
- `summary` — Total pools monitored, alerts triggered, top pools

### `quick` — Quick summary

Get a fast yield pool summary for a specific protocol/chain.

**Input:**
- `protocol` (string) — Protocol name
- `chain` (optional, string) — Chain filter
- `min_tvl` (number, default 100000) — Minimum TVL filter
- `limit` (number, default 10) — Max pools to return

**Returns:**
- Top pools by APY with stats, avg APY, total TVL

## Data Source

Uses [DefiLlama Yields API](https://defillama.com/yields) for real-time pool data across 200+ protocols and 30+ chains.

## Acceptance Criteria

- [x] Detects TVL or APY change beyond thresholds
- [x] Accurate metric tracking across major protocols (via DefiLlama API)
- [ ] Must be deployed on a domain and reachable via x402

## Solana Wallet

`66dG5r5TD37ahhrsAMKUroxML9Cqto5jRduifiMgQQ3G`

## Related Issue

Closes #6
