# Yield Pool Watcher

> DeFi yield pool monitoring agent built with [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit). Tracks APY and TVL across pools and alerts on sharp changes.

**Bounty:** [daydreamsai/agent-bounties#6](https://github.com/daydreamsai/agent-bounties/issues/6)

## Features

- **Real-time pool monitoring** — Fetches live data from [DeFi Llama](https://defillama.com) yields API
- **Configurable thresholds** — Set custom APY/TVL change percentages to trigger alerts
- **Multi-protocol support** — Monitor Aave, Lido, Compound, Uniswap, and 500+ protocols
- **Alert severity levels** — Info, warning, and critical classifications based on change magnitude
- **Historical tracking** — In-memory snapshot store compares current vs. previous values
- **Fully typed** — Zod-validated inputs and outputs on every entrypoint

## Architecture

```
┌─────────────────────────────────────────────┐
│              Yield Pool Watcher             │
├─────────────────────────────────────────────┤
│  Entrypoints:                               │
│  ├── monitor_pools   (main monitoring loop) │
│  ├── get_metrics     (current pool data)    │
│  ├── check_thresholds (evaluate rules)      │
│  └── get_alerts      (filtered alerts)      │
├─────────────────────────────────────────────┤
│  Alert Engine                               │
│  ├── APY spike/drop detection               │
│  ├── TVL spike/drain detection              │
│  └── Severity classification                │
├─────────────────────────────────────────────┤
│  DeFi Llama Client                          │
│  ├── /pools endpoint (all pool data)        │
│  └── /chart/:pool (historical data)         │
└─────────────────────────────────────────────┘
```

## Entrypoints

### `monitor_pools`
Main monitoring entrypoint. Fetches current pool data, compares with previous snapshots, and returns metrics + alerts.

**Input:**
```json
{
  "protocol_ids": ["aave-v3", "lido"],
  "pools": ["pool-id-1"],
  "threshold_rules": {
    "apyChangePercent": 20,
    "tvlChangePercent": 15,
    "minTvlUsd": 100000
  }
}
```

**Output:** `{ pool_metrics, deltas, alerts, summary }`

### `get_metrics`
Retrieve current APY, TVL, and optional historical chart data.

**Input:**
```json
{
  "protocol_ids": ["compound-v3"],
  "include_chart": true,
  "limit": 10
}
```

### `check_thresholds`
Evaluate custom thresholds against current data and return triggered alerts.

### `get_alerts`
Generate and filter alerts by severity, type, or protocol.

**Input:**
```json
{
  "protocol_ids": ["aave-v3"],
  "severity": "warning",
  "alert_type": "tvl_drain"
}
```

## Setup

### Prerequisites
- [Bun](https://bun.sh) >= 1.0.0 (recommended) or Node.js >= 18

### Install
```bash
cd submissions/yield-pool-watcher
bun install
# or: npm install
```

### Run
```bash
bun run dev
# or: bun run src/index.ts
```

The agent starts on port 3000 by default.

### Test
```bash
# Health check
curl http://localhost:3000/health

# List entrypoints
curl http://localhost:3000/entrypoints

# Monitor Aave and Lido pools
curl -X POST http://localhost:3000/entrypoints/monitor_pools/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"protocol_ids": ["aave-v3", "lido"]}}'

# Get metrics with chart data
curl -X POST http://localhost:3000/entrypoints/get_metrics/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"protocol_ids": ["compound-v3"], "include_chart": true, "limit": 5}}'

# Check with custom thresholds
curl -X POST http://localhost:3000/entrypoints/check_thresholds/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"protocol_ids": ["aave-v3"], "threshold_rules": {"apyChangePercent": 10, "tvlChangePercent": 5}}}'
```

## Deployment

### Docker
```dockerfile
FROM oven/bun:1-slim
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --production
COPY src/ src/
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `AGENT_KIT_WALLET_PRIVATE_KEY` | x402 payment wallet | — |
| `AGENT_KIT_PAYMENT_NETWORK` | Payment network | — |

## Data Source

All pool data is sourced from the [DeFi Llama Yields API](https://yields.llama.fi), which provides:
- APY and TVL for 10,000+ pools across 500+ protocols
- Historical chart data per pool
- No authentication required
- Free and open

## How Alerts Work

1. **First call** to `monitor_pools` stores a snapshot of all watched pools
2. **Subsequent calls** compare current values against the stored snapshot
3. Alerts trigger when changes exceed the configured thresholds:
   - **APY change** > threshold → `apy_spike` or `apy_drop`
   - **TVL change** > threshold → `tvl_spike` or `tvl_drain`
4. Severity is classified by magnitude:
   - **Info**: 20–25% change
   - **Warning**: 25–50% change
   - **Critical**: >50% change

## License

MIT
