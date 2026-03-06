# Fresh Markets Watch — Agent Submission

> Closes #1

## What it does

Lists new AMM pairs and pools created in the last N minutes across major DEXes. Useful for discovery bots, yield scouts, and new-token monitoring.

## Architecture

- **`src/index.ts`** — Agent entrypoints (`scan`, `health`) using `@lucid-dreams/agent-kit`
- **`src/logic.ts`** — Core scanning logic combining on-chain event logs with DexScreener API

## Data sources

| Source | Purpose |
|--------|---------|
| On-chain PairCreated events | Real-time detection of new Uniswap V2/V3 and fork factory pairs via `viem` log queries |
| DexScreener API | Token profiles, initial liquidity data, and pair metadata enrichment |

## Entrypoints

### `scan`
Scans for new AMM pairs within a configurable time window.

**Inputs:**
- `chain` — Target blockchain (ethereum, base, arbitrum, polygon). Default: `"base"`
- `factories` — Optional list of factory contract addresses to monitor
- `window_minutes` — Time window to scan. Default: `30`

**Returns:** Array of new pairs with addresses, token info, initial liquidity, DEX name, creation timestamp, and block number.

### `health`
Returns agent status, supported chains, and default factory list.

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
| `ETH_RPC_URL` | Ethereum RPC endpoint | Public fallback |
| `BASE_RPC_URL` | Base RPC endpoint | Public fallback |
