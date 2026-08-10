---
title: Bridge Route Pinger
bounty: 10
agent_repo: https://github.com/yunaremaia/bridge-route-pinger
live_url: https://bridge-route-pinger-phi.vercel.app
solana_wallet: CLpp9dZzBhAgZ316szi67Nas4AdMN4Cp6Ldy1FRuBEzr
---

# Bridge Route Pinger

## Summary

Agent that lists viable bridge routes and live fee/time quotes for token transfers across 6 EVM chains.

## How It Works

1. Accepts `token`, `amount`, `fromChain`, `toChain` as input
2. Queries 3 bridge providers in parallel: Across, Hop, Synapse
3. Parses fee (in USD) and ETA (in minutes) from each provider
4. Sorts routes by cheapest fee, breaking ties by fastest ETA
5. Returns best route + all alternatives + summary

## Supported Chains

- Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche

## Bridge Providers

- **Across** — `across.to` API
- **Hop** — `api.hop.exchange` API
- **Synapse** — `api.synapseprotocol.com` API

## Build & Test

```bash
npm install
npx tsc --noEmit   # 0 errors (strict mode)
npx vitest run     # 16/16 tests pass
```

## TDD Methodology

This agent was built with strict Test-Driven Development (Red-Green-Refactor):
- **RED**: Write failing test → verify it fails
- **GREEN**: Write minimal code to pass → verify it passes
- **REFACTOR**: Clean up while keeping tests green

### Test Coverage (16 tests, 4 files)

| File | Tests | What it covers |
|------|-------|----------------|
| `bridge.test.ts` | 4 | Route comparison logic (sort by fee, tie-break by ETA, empty/single routes) |
| `bridge-fetchers.test.ts` | 5 | API fetchers for Across/Hop/Synapse (mock fetch, parse fees, handle failures) |
| `handler.test.ts` | 4 | Business logic (aggregate routes, validate chains, error handling) |
| `agent.test.ts` | 3 | HTTP endpoint integration (health, invoke, error responses) |

## Endpoints

- `GET /health` — health check
- `POST /entrypoints/bridge/invoke` — main entrypoint

## Example

```bash
curl -X POST /entrypoints/bridge/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"token":"USDC","amount":"1000000","fromChain":"ethereum","toChain":"arbitrum"}}'
```

Response:
```json
{
  "run_id": "...",
  "status": "succeeded",
  "output": {
    "ok": true,
    "token": "USDC",
    "chainsScanned": ["ethereum", "arbitrum"],
    "totalRoutesChecked": 1,
    "routes": [{
      "bridge": "Hop",
      "feeUsd": 0.3,
      "etaMinutes": 5,
      "requirements": ["ETH for gas"]
    }],
    "bestRoute": { "bridge": "Hop", "feeUsd": 0.3, "etaMinutes": 5 },
    "summary": { "cheapestFeeUsd": 0.3, "fastestEtaMinutes": 5, "totalRoutes": 1 }
  }
}
```

## Tech Stack

- `@lucid-dreams/agent-kit` v0.2.24
- `x402-hono` v1.2.0 (payment middleware)
- `hono` (HTTP framework)
- `zod` (input validation)
- `vitest` (test runner)
- TypeScript strict mode

## Links

- **Source code:** https://github.com/yunaremaia/bridge-route-pinger
- **Live deployment:** https://bridge-route-pinger.vercel.app
- **Bounty issue:** #10
