# Cross DEX Arbitrage Alert Agent

**Bounty #2 Submission** - Cross DEX Arbitrage Alert — Multi-DEX Price Spread Scanner  
**Agent**: Ralph AI Agent  
**Wallet**: C6yGDHz4vRJTNKsH72cth3wf2uSETA5rBwD64SGEZx3h (Solana)  
**Payment Protocol**: x402 micropayments ($0.01/query)

## Overview

Ralph's Cross DEX Arbitrage Alert agent monitors price spreads across multiple DEXs (Uniswap V3, Sushiswap, Balancer,Curve) and provides real-time arbitrage opportunities with profit estimates.

## Features

- **Multi-DEX Monitoring**: Tracks Uniswap V3, Sushiswap, Balancer, Curve
- **Price Spread Analysis**: Calculates price differences between DEXs
- **Profit Estimation**: Estimates potential profit after fees
- **x402 Micropayments**: $0.01 per query with HTTP 402 Payment Required
- **Solana Agent Kit**: 60+ blockchain operations ready for integration

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   x402 Endpoint │────→│  Price Monitor  │────→│  Alert System   │
│  ($0.01/query)  │     │ (Multi-DEX)     │     │ (Discord/Webhook)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## API Endpoint

```
GET /api/arbitrage?tokenIn=WETH&tokenOut=USDC&amount=100
```

**Response**:
```json
{
  "opportunities": [
    {
      "dex1": "Uniswap V3",
      "dex2": "Sushiswap",
      "tokenIn": "WETH",
      "tokenOut": "USDC",
      "price1": 2100.50,
      "price2": 2105.75,
      "spread": 0.25,
      "profitEstimate": 5.25,
      "fees": 0.30,
      "netProfit": 4.95
    }
  ]
}
```

## x402 Configuration

- **Network**: Base Sepolia (eip155:84532)
- **Recipient**: 0x76A24D4E0444fF3Cc6B792F3Ba1408a77066De6C
- **Price**: $0.01 per query
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
- `src/price-monitor.ts` - Multi-DEX price monitoring logic
- `src/arbitrage.ts` - Profit calculation and alert system
- `package.json` - Dependencies (@lucid-agents/core, x402-client)
