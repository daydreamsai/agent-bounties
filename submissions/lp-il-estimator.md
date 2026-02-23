# LP Impermanent Loss Estimator — Agent Submission

> Closes #7

## What it does

Calculates impermanent loss and fee APR for any LP position or simulated deposit. Supports both historical analysis (using real price data) and hypothetical scenarios (user-specified price changes).

## Architecture

- **`src/index.ts`** — Agent entrypoints (`estimate`, `health`) using `@lucid-dreams/agent-kit`
- **`src/logic.ts`** — Core IL calculation engine with DexScreener integration

## Data sources

| Source | Purpose |
|--------|---------|
| DexScreener API | Pool discovery, price data, volume, TVL, fee tiers |
| IL math engine | Constant-product AMM impermanent loss formula |

## IL formula

For a constant-product (50/50) AMM:

```
IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
```

Where `priceRatio = currentPrice / entryPrice`. The result is always ≤ 0 (a loss relative to holding).

## Entrypoints

### `estimate`
Computes IL, fee APR, and net position value.

**Inputs:**
- `pool_address` — Optional LP pool address for direct lookup
- `token_a` / `token_b` — Token symbols or addresses
- `deposit_value_usd` — Simulated deposit value. Default: `"10000"`
- `window_hours` — Historical window for fee calculation. Default: `168` (7 days)
- `chain` — Target chain. Default: `"ethereum"`
- `price_change_pct` — Optional: simulate IL for a specific price change instead of using historical data

**Returns:** Pool info, IL metrics (percentage + USD), fee APR, net APR, simulation breakdown (HODL vs LP value, fees earned, net position).

### `health`
Returns agent status, supported AMMs, and data source list.

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
