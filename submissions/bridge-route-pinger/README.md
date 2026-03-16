# Bridge Route Pinger

**Bounty:** [Daydreams Agent Bounties #10](https://github.com/daydreamsai/agent-bounties/issues/10)

## Purpose

Lists viable bridge routes and live fee/time quotes for cross-chain token transfers using the Li.Fi API.

## Features

- Real-time route discovery via Li.Fi API (aggregates 20+ bridges)
- Fee quotes in USD including gas costs
- Transfer time estimates
- Best route recommendation by fee or speed
- Support for Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, BSC

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /routes` | Get all bridge routes for a transfer |
| `POST /best-route` | Get single best route (cheapest or fastest) |
| `POST /quote` | Quick quote for a specific bridge |

## Usage

```bash
npm install
npm start
```

Server runs on port **8085**.

## Example

```bash
curl -X POST http://localhost:8085/routes \
  -H "Content-Type: application/json" \
  -d '{"fromChain":"ethereum","toChain":"arbitrum","fromToken":"USDC","toToken":"USDC","amount":"1000"}'
```

## Tech Stack

- TypeScript + Node.js
- Li.Fi API (no API key needed for basic routes)
- Lucid Dreams Agent Kit
- Hono HTTP server
