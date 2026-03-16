# Yield Pool Watcher

**Bounty:** [Daydreams Agent Bounties #6](https://github.com/daydreamsai/agent-bounties/issues/6)

## Purpose

Tracks APY and TVL across DeFi pools and alerts on sharp changes. Monitors yield-bearing positions across Aave, Curve, Convex, Uniswap, Lido, and other major protocols.

## Features

- Real-time APY and TVL data via **DefiLlama Yields API** (no API key needed)
- **Alert detection**: flags pools with >20% APY spike, >15% APY drop, >25% TVL loss, or >10% TVL surge
- **Multi-protocol support**: Aave, Curve, Convex, Uniswap V3, Lido, Rocket Pool, Yearn, Beefy, and more
- **Pool comparison**: rank pools by APY with IL risk classification
- **Batch monitoring**: watch multiple pools simultaneously

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /watch` | Watch specific pools/protocols for changes |
| `POST /top-pools` | Get top pools by APY with filters |
| `POST /compare` | Compare APY across protocols for a token |

## Usage

```bash
npm install
npm start
```

Server starts on port **8083** by default.

### Example — Watch Pools

```bash
curl -X POST http://localhost:8083/watch \
  -H "Content-Type: application/json" \
  -d '{"protocols":["aave","lido"],"minApy":3,"alertThresholds":{"apySpikePct":20,"apyDropPct":15,"tvlDropPct":25}}'
```

### Example — Top Pools

```bash
curl -X POST http://localhost:8083/top-pools \
  -H "Content-Type: application/json" \
  -d '{"chains":["ethereum","arbitrum"],"minTvlUsd":1000000,"topN":10}'
```

## Tech Stack

- TypeScript + Node.js
- [DefiLlama Yields API](https://yields.llama.fi/docs)
- [Lucid Dreams Agent Kit](https://github.com/daydreamsai/lucid-agents)
- Hono HTTP server
