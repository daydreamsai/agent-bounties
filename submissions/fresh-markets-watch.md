# Fresh Markets Watch - Submission

**Bounty:** [Fresh Markets Watch](https://github.com/daydreamsai/agent-bounties/issues/1)
**Agent Name:** fresh-markets-watch
**Version:** 0.1.0

## Agent Description

Fresh Markets Watch is an DeFi monitoring agent that detects and lists new AMM pairs or pools created within a configurable time window. The agent monitors specified AMM factory contracts on supported blockchains and emits newly created pairs with their details including token addresses, initial liquidity, top holders, and creation timestamp.

## Live Deployment

- **URL:** https://fresh-markets-watch.vercel.app
- **x402 Payment Gateway:** https://fresh-markets-watch.vercel.app/x402

## Architecture

The agent is built using `@lucid-dreams/agent-kit` and consists of:

1. **Entrypoint: `discover-pairs`** - *(Note: The example in the issue uses `echo`, but the actual agent implements `discover-pairs` as the primary entrypoint)*
2. **Background Worker:** Polls AMM factory contracts for `PairCreated` events
3. **Event Indexer:** Maintains a sliding window of recent pair creations
4. **Liquidity Analyzer:** Fetches initial liquidity and top holder data

## Supported Chains & Factories

| Chain | Factory Address | Protocol |
|-------|----------------|----------|
| Ethereum | 0x5C69bEe701ef814a2B6a3EDD1EdaA294F3E85dD6 | Uniswap V2 |
| Ethereum | 0x1F98431 finer callable | Uniswap V3 |
| BSC | 0xcA143Ce32Fe78f1f7019d7d155a9e0c285865aA4 | PancakeSwap V2 |
| Polygon | 0x5757371414417DA8AF003DfEb7BC4e28D6E48467 | QuickSwap |
| Arbitrum | 0xf1D7CC64A0056E4b4Db6B534d8D3675B1E3fD95a | SushiSwap |
| Base | 0x8909Dc15e40175ef1DDcD410D55483437e5a5f0D | BaseSwap |

## API Specification

### Entrypoint: `discover-pairs`

**Input ScopedInput:**
