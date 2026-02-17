# Bridge Route Pinger 🌉

An agent built with [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit) that lists viable bridge routes and provides live fee/time quotes for cross-chain token transfers.

**Bounty:** [daydreamsai/agent-bounties#10](https://github.com/daydreamsai/agent-bounties/issues/10)

## Features

- **Real-time bridge route discovery** via [LI.FI](https://li.fi) aggregator (no API key required)
- **Fee comparison** across 10+ bridge protocols (Across, Stargate, Hop, Celer, Mayan, etc.)
- **Time estimation** for each route
- Three entrypoints: `get-routes`, `compare-fees`, `estimate-time`
- Supports all major EVM chains (Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, BSC, etc.)

## Quick Start

```bash
npm install
npm start
```

The agent starts on `http://localhost:3000` (configurable via `PORT` env var).

## Agent Card

The agent exposes an A2A-compatible agent card at:

```
GET http://localhost:3000/.well-known/agent.json
```

## Entrypoints

### `get-routes` — Get all bridge routes

Returns all viable bridge routes with fees, timing, and amounts.

```bash
curl -X POST http://localhost:3000/entrypoints/get-routes/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "token": "USDC",
      "amount": "100",
      "from_chain": "ethereum",
      "to_chain": "polygon"
    }
  }'
```

### `compare-fees` — Compare fees across routes

Returns routes sorted by lowest fee first, with the cheapest highlighted.

```bash
curl -X POST http://localhost:3000/entrypoints/compare-fees/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "token": "USDC",
      "amount": "1000",
      "from_chain": "ethereum",
      "to_chain": "arbitrum"
    }
  }'
```

### `estimate-time` — Estimate transfer times

Returns routes sorted by fastest first.

```bash
curl -X POST http://localhost:3000/entrypoints/estimate-time/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "token": "ETH",
      "amount": "1",
      "from_chain": "ethereum",
      "to_chain": "base",
      "decimals": 18
    }
  }'
```

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | ✅ | Token symbol (e.g. `USDC`, `ETH`, `WETH`) or contract address |
| `amount` | string | ✅ | Human-readable amount (e.g. `"100"` for 100 USDC) |
| `from_chain` | string | ✅ | Source chain name or chain ID (e.g. `ethereum`, `137`) |
| `to_chain` | string | ✅ | Destination chain name or chain ID (e.g. `arbitrum`, `8453`) |
| `decimals` | number | ❌ | Token decimals (default: 6). Use 18 for ETH/WETH |

## Supported Chains

| Chain | Aliases |
|-------|---------|
| Ethereum | `ethereum`, `eth` |
| Polygon | `polygon`, `pol`, `matic` |
| Arbitrum | `arbitrum`, `arb` |
| Optimism | `optimism`, `opt`, `op` |
| Base | `base` |
| Avalanche | `avalanche`, `avax` |
| BSC | `bsc`, `bnb` |
| Gnosis | `gnosis`, `xdai` |
| Fantom | `fantom`, `ftm` |
| zkSync Era | `zksync` |
| Linea | `linea` |
| Scroll | `scroll` |
| Blast | `blast` |

You can also pass any chain ID directly (e.g. `"42161"`).

## Response Format

Each route in the response includes:

```json
{
  "bridge": "AcrossV4",
  "from_token": "USDC",
  "to_token": "USDC",
  "from_amount": 100,
  "to_amount": 99.73,
  "to_amount_min": 99.73,
  "to_amount_usd": "99.73",
  "fee_usd": 0.30,
  "gas_usd": 0.03,
  "eta_minutes": 0.08,
  "eta_seconds": 5,
  "steps_count": 1
}
```

## Deployment

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

### Deploy to any Node.js host

```bash
git clone <this-repo>
cd bridge-route-pinger
npm install
PORT=8080 npm start
```

### Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/index.js"]
```

## Architecture

- **Runtime:** Node.js + Hono (via @lucid-dreams/agent-kit)
- **Data source:** [LI.FI API](https://docs.li.fi/) — aggregates 10+ bridge protocols
- **No API key required** — LI.FI quote/route endpoints are free and public
- **Protocol:** A2A (Agent-to-Agent) compatible via agent card

## License

MIT
