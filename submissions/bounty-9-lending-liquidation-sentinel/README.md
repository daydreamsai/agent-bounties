# Lending Liquidation Sentinel — Bounty #9

## Overview
A real-time Aave V3 lending position monitor that tracks health factors across Ethereum, Base, and Arbitrum. Fires alerts before health factor crosses 1.0, with accurate liquidation price calculations.

Built with `@lucid-dreams/agent-kit` and deployed via x402.

## Features
- **Multi-chain monitoring**: Ethereum, Base, Arbitrum (Aave V3)
- **Accurate health factor tracking**: Direct on-chain calls to Aave V3 Pool contracts
- **Liquidation price calculations**: Computes exact percentage drop needed to trigger liquidation
- **Risk classification**: safe / warning / critical / liquidatable
- **Configurable alert threshold**: Default 1.2, customizable per request

## Architecture
- `index.ts` — Agent entrypoints using `@lucid-dreams/agent-kit`
- `aave.ts` — On-chain Aave V3 data fetching via `viem`

## Entrypoints

### `monitor`
Monitor health factor and trigger alerts near liquidation.

**Input:**
```json
{
  "wallet": "0x88434C08dabE40DE5a92cA09580f39EF3C010119",
  "protocol_ids": ["aave_v3"],
  "chain_ids": [1, 8453, 42161],
  "alert_threshold": 1.2
}
```

**Output:**
```json
{
  "wallet": "0x...",
  "positions": [{
    "chain_id": 8453,
    "chain_name": "base",
    "health_factor": 1.0227,
    "liq_price_drop_percent": 2.22,
    "buffer_percent": 2.22,
    "alert_threshold_hit": true,
    "total_collateral_usd": 680535,
    "total_debt_usd": 632163,
    "liquidation_threshold": 8250
  }],
  "overall_health_factor": 1.0227,
  "overall_alert": true,
  "risk_level": "warning",
  "summary": "Monitoring 1 active position(s)..."
}
```

### `health`
Simple health check endpoint.

## Real-world Testing
This agent was built alongside a real flash loan liquidation bot deployed on Base (`0xe92c13245a2b844123E02eEfF2d7420387C51E7d`), actively monitoring a $632k debt position at HF=1.0227.

## Setup
```bash
npm install
npm start
```

## Tech Stack
- TypeScript + `@lucid-dreams/agent-kit`
- `viem` for on-chain data
- `zod` for input/output validation
- Aave V3 Pool contracts (direct multicall)
