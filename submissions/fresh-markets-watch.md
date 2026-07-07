# Fresh Markets Watch - Submission

## Agent Description

Fresh Markets Watch is decentralized finance (DeFi) monitoring agent that detects and lists new Automated Market Maker (AMM) pairs or pools created within a configurable time window. The agent is built using the `@lucid-dreams/agent-kit` framework and is designed for discovery bots and yield scouts who need real-time visibility into newly launched liquidity pools.

## Live Deployment

- **URL**: `https://fresh-markets-watch.example.com` (replace with actual domain)
- **x402 Payment Endpoint**: `https://fresh-markets-watch.example.com/x402`

## How It Works

The agent monitors specified AMM factory contracts on supported blockchains for `PairCreated` or `PoolCreated` events. It filters events by timestamp to identify pairs created within the requested time window, then enriches each result with:

- Token addresses in the pair
- Initial liquidity amount
- Top holder addresses
- Creation timestamp

## Supported Chains & Factories

| Chain | Factory Address | Protocol |
|-------|-----------------|----------|
| Ethereum | `0x5C69bEe701ef814a2B6a3EDD1EdaA2945cBa2dda` | Uniswap V2 |
| Ethereum | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | Uniswap V3 |
| BSC | `0xcA143Ce32Fe78f1f7019d7d9a5b3e0e2e8e5F8C9` | PancakeSwap V2 |
| Polygon | `0x5757371414417b8C6CCad43d257e5E2A0E7c4f7E` | QuickSwap |

## API / Entrypoints

### `discover`

Discover new AMM pairs created in the last N minutes.

**Input:**
