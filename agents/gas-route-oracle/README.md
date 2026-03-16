# GasRoute Oracle

Choose the cheapest chain and optimal timing for a swap or contract call across EVM networks.

## Description

GasRoute Oracle fetches real-time gas prices across multiple EVM chains (Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche) and recommends the most cost-effective chain for executing a transaction. It accounts for network congestion, calldata size, and gas unit estimates to provide accurate fee predictions.

## Entrypoints

### `estimate-gas`

Estimates gas costs across all supported chains and returns the cheapest option.

**Input:**
- `chain_set` — Array of chain identifiers to consider (e.g., `["ethereum", "arbitrum", "optimism", "base", "polygon"]`)
- `calldata_size_bytes` — Size of the transaction calldata in bytes
- `gas_units_est` — Estimated gas units needed for the transaction

**Returns:**
- `chain` — Recommended chain identifier
- `fee_native` — Estimated fee in the chain's native token
- `fee_usd` — Estimated fee in USD
- `busy_level` — Network congestion level (`low`, `medium`, `high`)
- `tip_hint` — Suggested priority fee in native token

## Acceptance Criteria

- ✅ Fee estimate within 5% of actual transaction cost
- ✅ Accounts for current network conditions (congestion, base fee trends)
- ✅ Deployed on a domain and reachable via x402

## Tech Stack

- **Runtime:** Node.js / TypeScript
- **Framework:** [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit)
- **Gas Data:** Public RPC providers + gas price APIs

## Running

```bash
cd agents/gas-route-oracle
npm install
npm run build
npm start
```

## Submission

Bounty: [#4 GasRoute Oracle](https://github.com/daydreamsai/agent-bounties/issues/4)
