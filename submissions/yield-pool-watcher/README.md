# Yield Pool Watcher

`yield-pool-watcher` tracks DeFi pool APY and TVL from DefiLlama, computes deltas, and emits threshold-based alerts for spikes or drains. For Aave V3 on Base, it also scans on-chain `ReserveDataUpdated` logs from the Aave V3 Pool to provide block-level APY signals.

It does not request private keys, sign transactions, or broadcast transactions.

## Input

```json
{
  "protocol_ids": ["aave-v3", "curve-dex"],
  "pools": [],
  "threshold_rules": {
    "tvl_drop_pct": 10,
    "tvl_spike_pct": 25,
    "apy_drop_pct": 20,
    "apy_spike_pct": 50,
    "apy_abs_change": 5,
    "min_tvl_usd": 1000000
  },
  "limit": 25,
  "include_charts": true
}
```

## Output

```json
{
  "pool_metrics": [],
  "deltas": [],
  "alerts": [],
  "warnings": [],
  "freshness": {
    "requested_at": "2026-06-14T00:00:00.000Z",
    "fetched_at": "2026-06-14T00:00:04.000Z",
    "pools_endpoint_latency_ms": 1200,
    "chart_points_checked": 5,
    "chart_latest_at": "2026-06-13T23:00:00.000Z",
    "chart_lag_seconds": 3600,
    "block_level_precision": true
  },
  "block_level_signals": [],
  "block_level_evidence": {
    "enabled": true,
    "latest_block": 1,
    "from_block": 1,
    "to_block": 1,
    "raw_log_count": 0,
    "decoded_signal_count": 0,
    "source": "aave-v3:ReserveDataUpdated"
  },
  "data_sources": [],
  "fetched_at": "2026-06-14T00:00:00.000Z"
}
```

## Data Sources

- DefiLlama yields `/pools` for current APY, TVL, chain, project, token metadata, IL risk, exposure, and predictions.
- DefiLlama yields `/chart/{pool}` for recent historical APY/TVL points when available.
- In-process memory snapshots as a fallback for immediate repeat-call deltas.
- Base public RPC `eth_getLogs` for Aave V3 Pool `ReserveDataUpdated` events, used as block-level APY signals for Aave V3 on Base.

The service does not fabricate per-block updates. It reports the actual data source used for each delta: `defillama_chart`, `service_memory`, `aave_v3_block_event`, or `none`.

Each delta includes `previous_observed_at`, `current_observed_at`, and `sample_interval_seconds` when the source provides enough timing evidence. The top-level `freshness` object reports provider latency and source lag explicitly. `block_level_precision` is true when the Aave V3 Base on-chain event adapter is enabled; DefiLlama chart deltas remain chart-level and are not misreported as block-level.

`block_level_signals` includes reserve address, block number, timestamp, transaction hash, log index, liquidity APY, and variable borrow APY from Aave V3 `ReserveDataUpdated` logs. `block_level_evidence` reports the scanned block range, raw log count, decoded signal count, and source.

## Alerts

Alerts are generated from caller-provided or default `threshold_rules`:

- TVL drop percentage
- TVL spike percentage
- APY drop percentage
- APY spike percentage
- APY absolute point change
- minimum TVL filter

## Local Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Optional live scan:

```bash
YIELD_PROTOCOL_IDS=aave-v3 \
YIELD_LIMIT=5 \
npm run watch:sample
```

The live sample should include `freshness.chart_lag_seconds`, `freshness.pools_endpoint_latency_ms`, `freshness.block_level_precision`, delta-level `sample_interval_seconds`, `block_level_evidence`, and recent `block_level_signals` when Base has emitted Aave V3 `ReserveDataUpdated` logs in the scanned block window.

## x402

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/yield-pool-watcher`
- Health: `https://gpt55.558686.xyz/yield-pool-watcher/health`
- Agent manifest: `https://gpt55.558686.xyz/yield-pool-watcher/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/yield-pool-watcher/entrypoints/watch_yield_pools/invoke`
The server exposes:

- `GET /health`
- `GET /.well-known/agent.json`
- `GET /entrypoints`
- `POST /entrypoints/watch_yield_pools/invoke`
- `POST /entrypoints/yield-pools/invoke`
- `POST /entrypoints/pools/invoke`
- `POST /invoke`

If `X402_PAY_TO` is set, all invoke routes are protected by `@x402/express`.
Public x402 smoke validation confirmed that unpaid POST requests to all protected invoke paths return HTTP 402 with a PAYMENT-REQUIRED header. The public manifest advertises Base x402 (eip155:8453) at $0.01 per request.
