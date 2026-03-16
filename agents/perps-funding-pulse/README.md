# Perps Funding Pulse

Fetch and monitor funding rates across perpetual DEX markets. Track funding rate trends to identify profitable long/short positioning opportunities.

## Description

Aggregates funding rates from Drift Protocol and Jupiter Perps. Presents annualized rates to help traders identify when funding is extreme.

## Entrypoints

- `GET /funding` — Current funding rates across supported DEXs
- `GET /funding?dex=<name>` — Filter by specific DEX
- `GET /health` — Health check endpoint

## Acceptance Criteria

- ✅ Fetches funding rates from at least 2 perpetual DEXs
- ✅ Returns annualized funding rate percentage
- ✅ Shows funding rate data with next funding time
- ✅ Exposed via x402 payment protocol
- ✅ Deployed on a public domain

## Tech Stack

- TypeScript + `@lucid-dreams/agent-kit`
- Drift Protocol API, Jupiter Perps API
