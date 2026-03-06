# Yield Pool Watcher — Agent Submission

> Closes #6

## What it does

Monitors DeFi pool metrics (APY, TVL) across major lending and yield protocols. Emits alerts when APY spikes or TVL drains exceed configurable thresholds.

## Architecture

- **`src/index.ts`** — Agent entrypoints (`watch`, `health`) using `@lucid-dreams/agent-kit`
- **`src/logic.ts`** — Core monitoring logic powered by DeFiLlama Yields API

## Data sources

| Source | Purpose |
|--------|---------|
| DeFiLlama Yields API | Pool APY, TVL, historical changes, IL risk classification |

## Entrypoints

### `watch`
Monitors pool metrics and generates alerts on significant changes.

**Inputs:**
- `protocol_ids` — DeFiLlama protocol slugs to monitor. Default: `["aave-v3", "compound-v3"]`
- `pools` — Optional specific pools to watch (by address or symbol)
- `apy_change_threshold` — Alert when APY changes by more than N percentage points. Default: `20`
- `tvl_change_threshold` — Alert when TVL changes by more than N%. Default: `15`
- `limit` — Maximum pools to return. Default: `20`

**Returns:** Pool metrics (APY, TVL, base/reward APY split, 1d/7d changes, IL risk, stablecoin flag) plus triggered alerts with severity levels.

### `health`
Returns agent status and supported protocol list.

## How to run

```bash
bun install
bun run start
```

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADDRESS` | Payment receive address | `0x0000...0000` |
| `NETWORK` | Payment network | `base-sepolia` |
| `DEFAULT_PRICE` | Default price per request | `1000` |
