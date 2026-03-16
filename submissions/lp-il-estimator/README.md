# LP Impermanent Loss Estimator

**Bounty:** [Daydreams Agent Bounties #7](https://github.com/daydreamsai/agent-bounties/issues/7)

## Purpose

Calculates impermanent loss (IL) and fee APR for any LP position or simulated deposit. Uses DefiLlama pools API for live pool data and CoinGecko for token price history.

## Features

- **Accurate IL formula**: `IL = 2*sqrt(r)/(1+r) - 1` for constant product AMMs (v2)
- **Concentrated liquidity support**: amplified IL calculation for Uniswap v3 / Algebra style pools
- **Live pool data** via DefiLlama Yields API: APY, TVL, volume, fee APR, reward APR, IL risk flag
- **Real price history** via CoinGecko: calculates actual price ratio change over window
- **PnL calculator**: compares LP value vs HODL value for a given deposit
- **Scenario simulator**: batch-compute IL across multiple price scenarios
- **Profitability warning**: warns when annualized IL exceeds fee APR

## Actions

| Action | Description |
|--------|-------------|
| `estimate_il` | Full IL estimate for a real pool position |
| `simulate_il` | Batch scenario simulation (no pool required) |
| `get_pool_metrics` | Live APY, TVL, volume from DefiLlama |
| `echo` | Health check |

## Usage

```bash
npm install
npm start
```

Server starts on port **8093** by default.

### Example — Estimate IL for a Real Pool

```bash
curl -X POST http://localhost:8093/invoke/estimate_il \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "pool_address": "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
      "token_weights": [50, 50],
      "deposit_amounts": [5000, 5000],
      "window_hours": 168
    }
  }'
```

### Example — Simulate IL Scenarios

```bash
curl -X POST http://localhost:8093/invoke/simulate_il \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "price_changes": [0.5, 0.75, 1.0, 1.5, 2.0, 3.0],
      "deposit_usd": 10000,
      "fee_apr": 15,
      "pool_type": "v2"
    }
  }'
```

## Response Format (estimate_il)

```json
{
  "IL_percent": -5.72,
  "il_explanation": "Moderate IL of 5.72% — evaluate if fee APR (12.3%) compensates.",
  "fee_apr_est": 12.3,
  "reward_apr": 2.1,
  "total_apr": 14.4,
  "volume_window": 42500000,
  "hodl_value_usd": 10850.00,
  "lp_value_usd": 10228.42,
  "net_pnl_usd": 228.42,
  "notes": ["Fees likely profitable: APR 14.4% vs annualized IL 8.6%"]
}
```

## Inputs

| Field | Description |
|-------|-------------|
| `pool_address` | Pool contract address or DefiLlama pool UUID |
| `token_weights` | Weight distribution e.g. `[50, 50]` |
| `deposit_amounts` | USD deposit per token e.g. `[5000, 5000]` |
| `window_hours` | Historical window (default: 168h = 7 days) |
| `price_ratio_override` | Manual price ratio override (skips CoinGecko fetch) |

## Tech Stack

- TypeScript + Node.js
- [DefiLlama Yields API](https://yields.llama.fi/docs)
- CoinGecko prices API (free tier)
- [Lucid Dreams Agent Kit](https://github.com/daydreamsai/lucid-agents)
- Hono HTTP server
