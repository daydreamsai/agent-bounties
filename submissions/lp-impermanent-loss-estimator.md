---
title: LP Impermanent Loss Estimator
bounty: 7
agent_repo: https://github.com/yunaremaia/lp-impermanent-loss-estimator
live_url: https://lp-impermanent-loss.vercel.app
solana_wallet: CLpp9dZzBhAgZ316szi67Nas4AdMN4Cp6Ldy1FRuBEzr
---

# LP Impermanent Loss Estimator

## Summary

Agent that calculates impermanent loss (IL) and fee APR for any LP position or simulated deposit. Uses the Uniswap v2 IL formula and The Graph subgraph data for on-chain pool metrics.

## How It Works

1. Accepts `pool_address`, `token_weights`, `deposit_amounts`, `window_hours`, `chain`, `entry_price_ratio`, `current_price_ratio`
2. Fetches pool TVL and reserves from Uniswap V2 subgraph
3. Fetches historical volume from pair day data snapshots
4. Computes IL using the formula: `IL = 1 - (2*sqrt(r) / (1+r))` where `r = current_price / entry_price`
5. Computes fee APR: `(volume * fee_rate / TVL) * (365 days / window)`
6. Returns IL %, fee APR, volume in window, and contextual notes

## TDD Methodology

Built with strict Test-Driven Development (Red-Green-Refactor):
- **RED**: Write failing test → verify it fails for the right reason
- **GREEN**: Write minimal code to pass → verify it passes
- **REFACTOR**: Clean up while keeping tests green

### Test Coverage (23 tests, 4 files)

| File | Tests | What it covers |
|------|-------|----------------|
| `il.test.ts` | 11 | IL formula (0% at r=1, 5.72% at r=0.5/2.0, symmetry, monotonicity, error cases) + fee APR calculation |
| `pool-fetcher.test.ts` | 5 | Subgraph queries (pool data, historical volume, error handling, null responses) |
| `estimator.test.ts` | 4 | End-to-end estimation (valid pool, not found, unsupported chain, IL=0 at no price change) |
| `agent.test.ts` | 3 | HTTP endpoint (health, invoke, error responses) |

## Supported Chains

- Ethereum (Uniswap V2 subgraph)
- Polygon (QuickSwap subgraph)
- Arbitrum (SushiSwap subgraph)

## Build & Test

```bash
npm install
npx tsc --noEmit   # 0 errors (strict mode)
npx vitest run     # 23/23 tests pass
```

## Endpoints

- `GET /health` — health check
- `POST /entrypoints/estimate/invoke` — main entrypoint

## Example

```bash
curl -X POST /entrypoints/estimate/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"pool_address":"0xb4e16d0168be52e9828bad15eb0eceae3a5b1cae","token_weights":[0.5,0.5],"deposit_amounts":["10","30000"],"window_hours":24,"chain":"ethereum","entry_price_ratio":1.0,"current_price_ratio":1.5}}'
```

## Tech Stack

- `@lucid-dreams/agent-kit` v0.2.24
- `x402-hono` v1.2.0 (payment middleware)
- `hono` + `zod` (HTTP + validation)
- `vitest` (test runner)
- TypeScript strict mode

## Links

- **Source code:** https://github.com/yunaremaia/lp-impermanent-loss-estimator
- **Live deployment:** https://lp-impermanent-loss-estimator.vercel.app
- **Bounty issue:** #7
