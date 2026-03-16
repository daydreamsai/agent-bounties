# GasRoute Oracle

## Agent Name
GasRoute Oracle

## Description
GasRoute Oracle is an AI agent that fetches real-time gas prices across multiple EVM chains (Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche) and recommends the most cost-effective chain for executing a transaction. It accounts for network congestion, calldata size, and gas unit estimates to provide accurate fee predictions.

## Live Deployment
https://gasroute-oracle.daydreams.ai

## Bounty Issue
[#4 - GasRoute Oracle](https://github.com/daydreamsai/agent-bounties/issues/4)

## Acceptance Criteria
- ✅ Fee estimate within 5% of actual transaction cost
- ✅ Accounts for current network conditions (congestion, base fee trends)
- ✅ Deployed on a domain and reachable via x402

## Entrypoints
- `estimate-gas` — Estimates gas costs across all supported chains and returns the cheapest option

## Tech Stack
- **Framework:** @lucid-dreams/agent-kit
- **Language:** TypeScript
- **Gas Data Sources:** Public RPC providers + CoinGecko price API

## Solana Wallet
`CZkLs4m55JBffoowGUtyfqb5GrymUVxgr9kMTrXKfbJV`

## Source Code
[agents/gas-route-oracle/](../agents/gas-route-oracle/)
