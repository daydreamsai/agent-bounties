# Cross DEX Arbitrage Alert

A DeFi agent that detects cross-DEX price spreads and arbitrage opportunities for token pairs using DexScreener and DeFiLlama APIs.

## Agent Info

- **Name:** cross-dex-arbitrage-alert
- **Version:** 0.1.0
- **Description:** Detect cross-DEX price spreads and arbitrage opportunities for token pairs using DexScreener and DeFiLlama

## Entrypoints

| Key | Description |
|-----|-------------|
| `arb` | Detect cross-DEX arbitrage opportunities for specified tokens by comparing prices across exchanges |
| `search` | Search for a specific token pair across DEXs and check for arbitrage spreads |
| `dexes` | List top DEXes with TVL data from DeFiLlama to identify liquidity sources |

## Data Sources

- **DexScreener** — Token pair prices, liquidity, and volume across DEXes
- **DeFiLlama** — DEX overview with TVL data and chain-level analytics

## Usage

### Install & Run Locally

```bash
npm install
npx tsx src/server.ts
```

The server starts on port 3003 by default.

### Endpoints

- `GET /health` — Health check
- `GET /.well-known/agent.json` — Agent manifest
- `GET /entrypoints` — List available entrypoints

### Example: Scan for Arbitrage

```json
POST /arb
{
  "tokens": ["BTC", "ETH", "SOL"],
  "min_spread_pct": 0.1
}
```

### Example: Search a Token

```json
POST /search
{
  "query": "WBTC"
}
```

### Example: Top DEXes

```json
POST /dexes
{
  "limit": 20
}
```

## Payments

This agent uses the x402 payment protocol. Set the following environment variables:

- `FACILITATOR_URL` — Payment facilitator endpoint
- `ADDRESS` — Solana wallet address (defaults to `66dG5r5TD37ahhrsAMKUroxML9Cqto5jRduifiMgQQ3G`)

## Cloudflare Workers Deployment

This agent can also be deployed as a Cloudflare Worker using `wrangler.toml`.