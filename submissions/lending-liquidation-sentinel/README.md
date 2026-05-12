# Lending Liquidation Sentinel

A DeFi agent that monitors borrow positions and warns before liquidation risk across lending protocols using DeFiLlama data.

## Agent Info

- **Name:** lending-liquidation-sentinel
- **Version:** 0.1.0
- **Description:** Watch borrow positions and warn before liquidation risk across DeFi lending protocols

## Entrypoints

| Key | Description |
|-----|-------------|
| `monitor` | Monitor a wallet's lending positions and assess liquidation risk across protocols |
| `positions` | Get detailed position breakdown for a wallet across lending protocols with collateral and debt info |
| `protocol` | Get protocol-level lending data including TVL and available chains |

## Data Sources

- **DeFiLlama Borrower API** — Wallet-level lending positions with collateral, debt, and health factors
- **DeFiLlama Protocol API** — Protocol-level TVL, borrowing data, and supported chains

## Usage

### Install & Run Locally

```bash
npm install
npx tsx src/server.ts
```

The server starts on port 3004 by default.

### Endpoints

- `GET /health` — Health check
- `GET /.well-known/agent.json` — Agent manifest
- `GET /entrypoints` — List available entrypoints

### Example: Monitor Wallet Risk

```json
POST /entrypoints/monitor/invoke
{
  "input": {
    "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "alert_threshold": 1.5
  }
}
```

### Example: Get Position Details

```json
POST /entrypoints/positions/invoke
{
  "input": {
    "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "protocol_ids": ["aave", "compound"]
  }
}
```

### Example: Protocol Data

```json
POST /entrypoints/protocol/invoke
{
  "input": {
    "protocol_id": "aave"
  }
}
```

## Acceptance Criteria

- ✅ Fires alert before health factor crosses 1.0 on test accounts
- ✅ Accurate liquidation price calculations
- ✅ Must be deployed on a domain and reachable via x402

## Payments

This agent uses the x402 payment protocol. Set the following environment variables:

- `FACILITATOR_URL` — Payment facilitator endpoint
- `ADDRESS` — Solana wallet address (defaults to `66dG5r5TD37ahhrsAMKUroxML9Cqto5jRduifiMgQQ3G`)

## Cloudflare Workers Deployment

This agent can also be deployed as a Cloudflare Worker using `wrangler.toml`.