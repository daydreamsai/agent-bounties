# Lending Liquidation Sentinel

**Bounty:** [Daydreams Agent Bounties #9](https://github.com/daydreamsai/agent-bounties/issues/9)

## Purpose

Monitors Aave V3 borrow positions and warns before liquidation risk based on health factor thresholds.

## Features

- Real-time health factor monitoring via Aave V3 REST API and The Graph
- Multi-chain: Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche
- Alert levels: Safe (>1.5), Warning (1.2-1.5), Danger (1.0-1.2), Critical (<1.0)
- Liquidation price calculation for collateral assets
- Batch position monitoring for multiple wallets

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Service health check |
| `POST /check-position` | Check health factor for a wallet |
| `POST /monitor` | Monitor positions with configurable alerts |
| `POST /liquidation-price` | Calculate liquidation price for a position |

## Usage

```bash
npm install
npm start
```

Server runs on port **8084**.

## Tech Stack

- TypeScript + Node.js
- Aave V3 REST API + The Graph subgraphs
- Lucid Dreams Agent Kit
- Hono HTTP server
