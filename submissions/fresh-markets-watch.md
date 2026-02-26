# Fresh Markets Watch Agent

## Description
A DeFi monitoring agent that scans DEX factories for newly created trading pairs across multiple chains (Ethereum, Arbitrum, Polygon, BSC, Avalanche). Detects new pairs within specified time ranges and returns detailed information including pair addresses, tokens, creation blocks, and more.

## Live Deployment
- **Main Endpoint:** https://ljapptest--fresh-markets-watch-handle.modal.run
- **Health Check:** https://ljapptest--fresh-markets-watch-health.modal.run
- **Invoke Agent:** https://ljapptest--fresh-markets-watch-invoke.modal.run

## Bounty Issue
[Fresh Markets Watch - Issue #1](https://github.com/daydreamsai/agent-bounties/issues/1)

## Acceptance Criteria Checklist

### Input
- [x] Accepts `chain` parameter (ethereum, arbitrum, polygon, bsc, avalanche)
- [x] Accepts optional `since` parameter (ISO timestamp)
- [x] Accepts optional `until` parameter (ISO timestamp)

### Output
- [x] Returns array of new pairs with:
  - Pair address
  - Token0 and Token1 addresses
  - Creation block number
  - Transaction hash
- [x] Returns total count of pairs found

### Agent Behavior
- [x] Built with `@lucid-dreams/agent-kit`
- [x] Implements proper error handling
- [x] Validates chain parameters

### Deployment
- [x] Deployed on Modal with public URL
- [x] Health endpoint returns agent status
- [x] All endpoints accessible via HTTP

## Solana Wallet Address for Payment
`3C1vCMFrgHDRqsLshw7pUx6mST9Wc854neRmDhyTBP8t`

## Technical Details
- **Runtime:** Bun + TypeScript
- **Blockchain Library:** viem
- **Deployment:** Modal (serverless)
- **Supported Chains:** Ethereum, Arbitrum, Polygon, BSC, Avalanche
- **DEX Support:** Uniswap V2, SushiSwap, PancakeSwap, Trader Joe, etc.

## Entrypoints
1. **scan-new-pairs** - Scans DEX factories for new pairs within time range
2. **health** - Returns agent health status

## Repository
Agent code available in the submission branch.
