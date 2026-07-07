# Fresh Markets Watch Agent Submission

## Agent Description

Fresh Markets Watch is an AI agent that monitors AMM factory contracts for new pair/pool creations in real-time. It detects new liquidity pools within seconds of creation and returns detailed information about each new pair including token addresses, initial liquidity, top holders, and creation timestamp.

## Live Deployment

- **URL**: `https://fresh-markets-watch.vercel.app`
- **x402 Payment Gateway**: Enabled at `https://fresh-markats-watch.vercel.app/x402`

## Architecture

The agent is built using:
- `@lucid-dreams/agent-kit` for the agent framework
- `viem` for Ethereum blockchain interaction
- WebSocket streaming for real-time event monitoring
- Redis for deduplication and caching

## How It Works

1. **Factory Monitoring**: Subscribes to `PairCreated` events on Uniswap V2/V3 and compatible factory contracts
2. **Real-time Detection**: Uses WebSocket connections to receive events within seconds of emission
3. **Pair Analysis**: Fetches token details, initial liquidity, and holder information
4. **Deduplication**: Redis-backed deduplication to prevent duplicate reports
5. **x402 Integration**: Exposes endpoints via x402 payment protocol

## Supported Chains

- Ethereum mainnet
- Arbitrum
- Optimism
- Base
- Polygon

## API Endpoints (via x402)

### `POST /discover`

List new AMM pairs created in the last N minutes.

**Request:**
