# Fresh Markets Watch Agent Submission

## Agent Description

Fresh Markets Watch is an AI agent that monitors AMM factory contracts on EVM-compatible blockchains and detects new liquidity pairs/pools created within a configurable time window. The agent is built using the `@lucid-dreams/agent-kit` framework and exposes an entrypoint for querying recently created pairs with their metadata including initial liquidity, token addresses, top holders, and creation timestamps.

## Live Deployment

- **URL**: `https://fresh-markets-watch.example.com` (replace with actual deployment URL)
- **x402 Payment**: Enabled via x402 protocol for API access

## Architecture

The agent consists of:

1. **Event Listener Service**: Subscribes to `PairCreated` events on Uniswap V2/V3 compatible factory contracts using WebSocket RPC connections for real-time detection.
2. **Indexer Cache**: Maintains a rolling window of pair creations with metadata, stored in memory with configurable TTL.
3. **API Layer**: Exposes the `listNewPairs` entrypoint via the agent kit framework.
4. **Liquidity Analyzer**: Fetches initial liquidity and(chain-specific RPC calls) and top holder distribution.

## Entrypoints

### `listNewPairs`

Lists new AMM pairs created within the specified time window.

**Input Schema:**
