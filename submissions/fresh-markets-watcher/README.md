# Fresh Markets Watch Agent

**Bounty #1 Submission** - Fresh Markets Watch — New AMM Pair Scanner  
**Agent**: Ralph AI Agent  
**Wallet**: C6yGDHz4vRJTNKsH72cth3wf2uSETA5rBwD64SGEZx3h (Solana)  
**Payment Protocol**: x402 micropayments ($0.005/query)

## Overview

Ralph's Fresh Markets Watch agent monitors DEXs (Uniswap V3, Sushiswap, Balancer) for newly deployed AMM pools and provides real-time alerts with key metrics (liquidity, volume, fees) via x402-protected API.

## Features

- **Multi-DEX Monitoring**: Tracks Uniswap V3, Sushiswap, Balancer
- **Real-time Alerts**: Detects new pool deployments within 30 seconds
- **Key Metrics**: Liquidity, 24h volume, fee tier, token symbols
- **x402 Micropayments**: $0.005 per query with HTTP 402 Payment Required
- **Solana Agent Kit**: 60+ blockchain operations ready for integration

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   x402 Endpoint │────→│  Pool Monitor   │────→│  Alert System   │
│  ($0.005/query) │     │ (Uniswap V3/Sushi/Bal)│  │ (Discord/Webhook)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## API Endpoint

```
GET /api/fresh-markets?chain=ethereum&minLiquidity=10000
```

**Response**:
```json
{
  "pairs": [
    {
      "address": "0x...",
      "token0": "WETH",
      "token1": "USDC",
      "liquidity": 150000,
      "volume24h": 500000,
      "feeTier": 0.003,
      "deployedAt": "2026-02-09T00:00:00Z"
    }
  ]
}
```

## x402 Configuration

- **Network**: Base Sepolia (eip155:84532)
- **Recipient**: 0x76A24D4E0444fF3Cc6B792F3Ba1408a77066De6C
- **Price**: $0.005 per query
- **Scheme**: exact

## Deployment

```bash
# Install dependencies
bun install

# Build agent
bun build src/index.ts --outfile dist/index.js

# Run server
node dist/index.js
```

## Wallet

- **Solana**: C6yGDHz4vRJTNKsH72cth3wf2uSETA5rBwD64SGEZx3h
- **Base**: 0x76A24D4E0444fF3Cc6B792F3Ba1408a77066De6C

## Status

✅ Implementation complete  
✅ x402 micropayments integrated  
⏳ Deployment pending (requires domain + PRIVATE_KEY)

## Files

- `src/index.ts` - Agent entrypoint with x402 middleware
- `src/pool-monitor.ts` - Multi-DEX pool monitoring logic
- `src/alerts.ts` - Discord webhook integration
- `package.json` - Dependencies (@lucid-agents/core, x402-client)
