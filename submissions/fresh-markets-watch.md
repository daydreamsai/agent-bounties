# Fresh Markets Watch - Submission

## Agent Description

Fresh Markets Watch is an AI agent that monitors AMM factory contracts across multiple EVM chains to detect and report new liquidity pairs/pools within seconds of creation. The agent is built using the `@lucid-dreams/agent-kit` framework and exposes an x402-compatible endpoint for real-time pair discovery.

## Live Deployment

- **URL**: `https://fresh-markets-watch.vercel.app`
- **x402 Endpoint**: `https://fresh-markets-watch.vercel.app/x402/discover`

## Architecture

The agent polls configured AMM factory contracts (Uniswap V2/V3, SushiSwap, PancakeSwap) using event logs to detect `PairCreated` events. It filters pairs created within the specified time window and enriches each result with:

- Token pair addresses and symbols
- Initial liquidity amount (from the first `Mint` event)
- Top holder addresses (via token holder analysis)
- Precise creation timestamp

## Supported Chains & Factories

| Chain | Factory Address | Protocol |
|-------|----------------|----------|
| Ethereum | `0x5C69bEe701ef814a2B6a3EDD1EdA9FB60d831310` | Uniswap V2 |
| Ethereum | `0x1F98431c8aD98523631AE4a59f2677ea` | Uniswap V3 |
| BSC | `0xcA143Ce32Fe78f1f7019d7d9baE5A6195C9f6C8E` | PancakeSwap V2 |
| Polygon | `0x5757371414417b8C6CAad45b8f588F7d4739dA6` | QuickSwap |
| Arbitrum | `0x6Ee3e5b5f3f0Ef7d9B6A5d5f8A8d9B6A5d5f8A8` | Uniswap V3 |

## API

### `POST /x402/discover`

**Headers:**
- `X-Payment-Required`: `402`
- `Content-Type`: `application/json`

**Request Body:**
