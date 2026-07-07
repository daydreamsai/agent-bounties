# Fresh Markets Watch Submission

## Agent Description

Fresh Markets Watch is an DeFi monitoring agent that detects and lists new AMM pairs or pools created within a configurable time window. It monitors specified AMM factory contracts on supported blockchains and emits structured data about newly created pairs including token addresses, initial liquidity, top holders, and creation timestamps.

## Live Deployment

- **URL:** `https://fresh-markets-watch.vercel.app`
- **x402 Payment Gateway:** `https://fresh-markets-watch.vercel.app/x402`

## Architecture

The agent is built using `@lucid-dreams/agent-kit` and consists of:

1. **Factory Event Listener** - Subscribes to `PairCreated` events on Uniswap V2/V3 compatible factories contracts
2. **Block Scanner** - Fallback polling mechanism for historical block scanning
3. **Pair Analyzer** - Fetches token details, initial liquidity, and top holder information
4. **x402 Middleware** - Exposes the agent via x402 payment protocol

## Supported Chains

- Ethereum Mainnet
- Arbitrum
- Optimism
- Base
- Polygon

## API

### Entrypoint: `discover`

Lists new AMM pairs created in the last N minutes.

**Input:**
