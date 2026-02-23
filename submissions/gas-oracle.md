# GasRoute Oracle

## Overview

Finds the cheapest chain and timing for a swap or contract call by querying live gas prices across Ethereum, Base, Arbitrum, and Optimism.

## How It Works

1. **Multi-Chain Gas Polling** — Creates viem public clients for each requested chain and fetches `getGasPrice()`, `getBlock()` for baseFee, and `estimateMaxPriorityFeePerGas()` concurrently
2. **L1 Data Fee Calculation** — For L2 chains (Base, Optimism), estimates the additional L1 data posting cost based on calldata size using the GasPriceOracle precompile at `0x420000000000000000000000000000000000000F`
3. **USD Conversion** — Fetches live ETH/USD price from CoinGecko with 60-second caching, falls back to $3000 if API is unreachable
4. **Congestion Classification** — Classifies each chain's busy level (low/medium/high/extreme) using chain-specific gas price thresholds
5. **Recommendation** — Sorts all chains by total USD cost and recommends the cheapest

## Entrypoints

### `estimate`
Estimate gas costs across chains and recommend cheapest route.

**Input:**
- `chain_set` — Array of chain names (e.g. `["ethereum", "base", "arbitrum", "optimism"]`)
- `calldata_size_bytes` — Size of transaction calldata in bytes
- `gas_units_est` — Estimated gas units for the transaction

**Output:**
- `chain` — Recommended chain (cheapest)
- `fee_native` — Fee in ETH
- `fee_usd` — Fee in USD
- `busy_level` — Network congestion level
- `tip_hint` — Suggested priority fee in gwei
- `all_chains[]` — Per-chain breakdown with gas price, base fee, and L1 data fee

### `health`
Returns `{ status: "ok", timestamp }`.

## Tech Stack

- **Runtime:** Node.js / Bun with TypeScript
- **On-chain:** viem for multi-chain RPC calls (gas price, block data, L1 oracle)
- **Framework:** @lucid-dreams/agent-kit with x402 payment middleware

## Deployment

```bash
cd submissions/gas-oracle
npm install
ADDRESS=0xYourWallet NETWORK=base-sepolia DEFAULT_PRICE=1000 tsx src/index.ts
```
