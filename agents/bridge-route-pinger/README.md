# Bridge Route Pinger

List bridge routes between chains with fee and time estimates. Find the cheapest and fastest cross-chain transfer paths.

## Description

Queries Mayan Finance, Wormhole Portal, and deBridge APIs to find available cross-chain routes. Returns comparable fee, time, and reliability data.

## Entrypoints

- `GET /routes?from=<chain>&to=<chain>&token=<symbol>` — List bridge routes
- `GET /routes/compare?from=<chain>&to=<chain>` — Compare routes
- `GET /health` — Health check endpoint

## Acceptance Criteria

- ✅ Returns routes from at least 2 bridge protocols
- ✅ Shows estimated fees (USD) and transfer time for each route
- ✅ Sorts by cheapest or fastest
- ✅ Exposed via x402 payment protocol
- ✅ Deployed on a public domain

## Tech Stack

- TypeScript + `@lucid-dreams/agent-kit`
- Mayan Finance API, Wormhole API, deBridge API
