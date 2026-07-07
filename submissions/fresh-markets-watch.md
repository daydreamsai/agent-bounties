# Fresh Markets Watch - Submission

## Agent Description

Fresh Markets Watch is an AI agent that monitors AMM factory contracts for new pair/pool creations in real-time. It scans specified factory contracts within a configurable time window and returns detailed information about newly created pairs including token addresses, initial liquidity, top holders, and creation timestamps.

## Live Deployment

- **URL**: `https://fresh-markets-watch.example.com` (replace with actual deployment URL)
- **x402 Payment Gateway**: Enabled at `https://fresh-markets-watch.example.com/x402`

## Architecture

The agent is built using `@lucid-dreams/agent-kit` and consists of:

1. **Entrypoint**: `discoverNewPairs` - Main entrypoint for discovering new AMM pairs
2. **Polling Service**: Background service that polls factory contracts for `PairCreated` events
3. **Data Enrichment**: Fetches token details, liquidity amounts, and top holder information
4. **x402 Integration**: Payment middleware for agent access

## Implementation Details

### Core Logic

