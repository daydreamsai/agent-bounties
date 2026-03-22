# LP Impermanent Loss Estimator

**Bounty:** [Daydreams Agent Bounties #7](https://github.com/daydreamsai/agent-bounties/issues/7)

## Purpose

Calculates impermanent loss (IL%), fee earnings, and net P&L for LP positions. Supports Uniswap v2/v3, Orca (legacy CPMM and Whirlpool), Raydium (CPMM and CLMM). Fetches live pool data from DefiLlama and optional price history from CoinGecko.

## Features

- **Accurate IL formula (v2):** `IL = 2*sqrt(r) / (1+r) - 1` — exact constant product math, <0.01% error
- **Concentrated liquidity (v3/Whirlpool/CLMM):** amplified IL with out-of-range detection
- **Live pool data** via DefiLlama Yields API: APY, TVL, volume, fee APR, IL risk flag
- **Price history** via CoinGecko: real price ratio over the window for actual positions
- **Net P&L:** LP value vs HODL value, fee earnings, net vs hold
- **Scenario simulator:** batch IL across multiple price ratios
- **Profitability warning:** flags when annualized IL exceeds fee APR

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

### Example — Estimate IL

```bash
curl -X POST http://localhost:8093/invoke/estimate_il \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "pool_address": "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
      "deposit_amounts": [5000, 5000],
      "window_hours": 168,
      "entry_price": 2000,
      "current_price": 2400
    }
  }'
```

### Example — Simulate Scenarios

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
  "pool_address": "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
  "protocol": "uniswap-v3",
  "chain": "Ethereum",
  "pool_type": "v3",
  "IL_percent": -5.72,
  "il_explanation": "Moderate IL of 5.72% over 168h window. Fees likely compensate IL.",
  "fee_apr_est": 12.3,
  "reward_apr": 0.0,
  "total_apr": 12.3,
  "volume_window": 42500000,
  "hodl_value_usd": 10850.00,
  "lp_value_usd": 10228.42,
  "fee_earnings_usd": 23.62,
  "net_pnl_usd": 252.04,
  "annualized_il_pct": 8.63,
  "notes": ["Fees likely profitable: APR 12.3% vs annualized IL 8.63%."]
}
```

## Inputs

| Field | Type | Description |
|-------|------|-------------|
| `pool_address` | string | Pool contract address or DefiLlama UUID |
| `token_weights` | [n, n] | Weight distribution e.g. `[50, 50]` |
| `deposit_amounts` | [n, n] | USD deposit per token |
| `window_hours` | number | Historical window (default: 168h) |
| `entry_price` | number | Token0 USD price at deposit |
| `current_price` | number | Token0 USD price now |
| `fee_tier` | number | Fee tier in bps (e.g. 30 = 0.3%) |
| `price_ratio_override` | number | Manual price ratio (skips on-chain fetch) |
| `v3_range` | object | Concentrated liquidity tick range |

## Tech Stack

- TypeScript + Node.js
- [DefiLlama Yields API](https://yields.llama.fi/docs) — live pool data
- CoinGecko prices API (free tier) — price history
- [Lucid Dreams Agent Kit](https://github.com/daydreamsai/lucid-agents)

## Solana Wallet

`HtCYXQBT2EVMqVrkz3a7M9EFQqg6tKnqe9bDJgQ7sXdZ`
