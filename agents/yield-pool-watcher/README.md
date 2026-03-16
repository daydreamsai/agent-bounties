# Yield Pool Watcher

Track APY and TVL across pools and alert on sharp changes.

## Overview

This agent monitors DeFi yield pool metrics in real-time using the DeFiLlama API. It tracks APY and TVL changes across protocols and emits alerts when metrics breach configurable thresholds.

## Features

- **Multi-protocol support**: Monitors any protocol on DeFiLlama (Aave, Lido, Uniswap, Curve, etc.)
- **Real-time metrics**: Fetches current APY, TVL, and reward token data
- **Delta tracking**: Compares current state with previous snapshots to detect changes
- **Configurable alerts**: Custom threshold rules for TVL and APY changes
- **Historical data**: Access to pool history for deeper analysis

## Entrypoints

### `watch`

Monitor pools and check for alert conditions. First call establishes a baseline; subsequent calls detect changes.

**Input:**
```json
{
  "protocol_ids": ["aave-v3", "lido"],
  "pools": [],
  "threshold_rules": [
    { "metric": "tvl", "direction": "decrease", "thresholdPercent": 20, "severity": "critical" },
    { "metric": "apy", "direction": "increase", "thresholdPercent": 100, "severity": "info" }
  ]
}
```

### `protocols`

List all available DeFi protocols.

### `pool-detail`

Get detailed info and history for a specific pool.

### `health-check`

Check connectivity to DeFiLlama API.

## Default Alert Rules

| Metric | Direction | Threshold | Severity |
|--------|-----------|-----------|----------|
| TVL | decrease | 20% | critical |
| TVL | increase | 50% | warning |
| APY | decrease | 30% | warning |
| APY | increase | 100% | info |

## Running

```bash
bun install
bun run dev    # development
bun run start  # production
```

## Deployment

Deploy on any platform that supports Bun and ensure it's reachable via x402.

## License

MIT
