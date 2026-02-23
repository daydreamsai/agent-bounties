# Bridge Route Pinger

## Overview

Lists viable bridge routes and live fee/time quotes for cross-chain token transfers. Aggregates routes from multiple bridge protocols via the LI.FI API.

## How It Works

1. **Token Resolution** — Maps common token symbols (USDC, USDT, ETH, DAI, WETH) to their per-chain contract addresses. Supports Ethereum, Base, Arbitrum, and Optimism.
2. **Chain ID Mapping** — Converts chain names to numeric chain IDs (Ethereum=1, Base=8453, Arbitrum=42161, Optimism=10)
3. **Route Quoting** — Queries the LI.FI `/v1/quote` endpoint which aggregates quotes from Across, Stargate, Hop, Celer, and other bridge protocols
4. **Fee Breakdown** — Extracts gas costs, bridge fees, and slippage from the LI.FI response
5. **ETA Estimation** — Parses estimated execution time per route step
6. **Multi-Route Comparison** — Also queries `/v1/connections` for available bridge options and returns ranked routes

## Entrypoints

### `find_routes`
Find optimal bridge routes for a cross-chain token transfer.

**Input:**
- `token` — Token symbol or address (e.g. "USDC", "ETH")
- `amount` — Amount to transfer in human units (e.g. "1000")
- `from_chain` — Source chain (ethereum, base, arbitrum, optimism)
- `to_chain` — Destination chain

**Output:**
- `routes[]` — Available bridge routes:
  - `bridge` — Bridge protocol name (e.g. "across", "stargate")
  - `estimated_output` — Expected output amount
  - `fee_usd` — Total fee in USD
  - `eta_minutes` — Estimated transfer time
  - `steps` — Detailed route steps
- `best_route` — Index of the recommended route
- `requirements` — Gas tokens needed on source chain

### `health`
Returns `{ status: "ok", timestamp }`.

## Supported Chains

| Chain | ID | USDC Address |
|-------|----|-------------|
| Ethereum | 1 | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |
| Base | 8453 | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| Arbitrum | 42161 | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 |
| Optimism | 10 | 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 |

## Tech Stack

- **Runtime:** Node.js / Bun with TypeScript
- **Routing:** LI.FI API for cross-bridge aggregation
- **Framework:** @lucid-dreams/agent-kit with x402 payment middleware

## Deployment

```bash
cd submissions/bridge-route-pinger
npm install
ADDRESS=0xYourWallet NETWORK=base-sepolia tsx src/index.ts
```
