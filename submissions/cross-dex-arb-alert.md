# Cross DEX Arbitrage Alert — Agent Submission

> Closes #2

## What it does

Detects cross-DEX token price spreads that exceed a configurable threshold after accounting for protocol fees and estimated gas costs. Identifies profitable arbitrage opportunities across multiple DEX aggregators.

## Architecture

- **`src/index.ts`** — Agent entrypoints (`scan`, `health`) using `@lucid-dreams/agent-kit`
- **`src/logic.ts`** — Core arbitrage detection logic querying multiple DEX price sources

## Data sources

| Source | Purpose |
|--------|---------|
| Paraswap API | DEX aggregator quotes with fee breakdown |
| DexScreener API | Real-time pool prices across DEXes |
| Gas price oracles | Accurate gas cost estimation |

## Entrypoints

### `scan`
Detects cross-DEX price spreads for a given token pair.

**Inputs:**
- `token_in` — Input token address or symbol (e.g. `"WETH"`)
- `token_out` — Output token address or symbol (e.g. `"USDC"`)
- `amount_in` — Amount in human-readable units (e.g. `"1"` for 1 WETH)
- `chains` — Chains to scan. Default: `["ethereum"]`
- `min_spread_bps` — Minimum net spread to report in basis points. Default: `10`

**Returns:** Array of arbitrage opportunities with buy/sell DEX, gross/net spread in bps, estimated profit in USD, and gas cost estimates. Includes `best_route` highlighting the most profitable opportunity.

### `health`
Returns agent status, supported chains, and DEX list.

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
