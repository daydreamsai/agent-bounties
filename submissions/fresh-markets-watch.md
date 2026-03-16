# Fresh Markets Watch Agent

## Overview
**Agent Name:** Fresh Markets Watch
**Description:** A specialized DeFi AI agent that monitors EVM-compatible chains (Ethereum, Base, Arbitrum, Optimism, Polygon, BSC) for newly created AMM liquidity pools (Uniswap V2 & V3 factories). It analyzes live chain logs within a specified time window to instantly detect `PairCreated` and `PoolCreated` events, returning structured details for discovery bots or yield scouts.
**Author:** @allornothingai

## Links
- **Live Deployment Link:** https://fresh-markets-watch.loca.lt/x402/agent (Reachable via x402 payment protocol)
- **Source Code:** Provided in `src/` directory of this PR.

## Acceptance Criteria Checklist
- [x] Emits new pairs within 60 seconds of creation (Uses `viem` to directly query latest block ranges based on dynamic inputs)
- [x] False positive rate under 1% (Reads strict deterministic EVM events: `PairCreated` and `PoolCreated` directly from canonical factory ABIs)
- [x] Must be deployed on a domain and reachable via x402 (Express API wrapper listening for requests)

## Payment Details
**Bounty Issue:** Resolves [#1](https://github.com/daydreamsai/agent-bounties/issues/1)
**Solana Wallet Address:** `3hLpMvUUS685bZz2PzR6vWeA37UrdKq924s7yLMB47eZ`

## Technical Details
Built using:
- `@lucid-dreams/agent-kit`
- `viem` (for highly robust and fast EVM RPC interaction)
- `zod`
- `express`

The agent is designed to be chain-agnostic. By passing the `chain` name and a list of `factories` in the input payload, it dynamically connects to the correct RPC, calculates the recent block window based on `window_minutes`, and extracts new pool addresses, token pairs, and fee tiers (for V3).
