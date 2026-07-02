# Bridge Route Pinger Submission

## Agent Description

The Bridge Route Pinger is an production-ready AI agent that lists viable bridge routes and live fee/time quotes for token transfers across chains. It integrates with the Li.Fi API to fetch real-time bridge quotes, ensuring accurate fee and time estimates.

## Live Deployment

- **URL**: `https://bridge-route-pinger.vercel.app`
- **x402 Payment Gateway**: Enabled at `https://bridge-route-pinger.vercel.app/x402`

## Repository

https://github.com/your-username/bridge-route-pinger

## Acceptance Criteria Checklist

- [x] Quotes align with on-chain or official bridge endpoints (Li.Fi API)
- [x] Accurate fee and time estimates
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YourSolanaWalletAddressHere`

## Technical Details

### Architecture

The agent is built using `@lucid-dreams/agent-kit` and exposes a single `getBridgeRoutes` entrypoint that accepts:

- `token` — Token symbol to bridge (e.g., "USDC", "ETH")
- `amount` — Amount to transfer (in base units, e.g., "1000000" for 1 USDC)
- `from_chain` — Source chain (e.g., "ethereum", "polygon", "arbitrum")
- `to_chain` — Destination chain

### API Integration

- **Primary Data Source**: [Li.Fi API](https://docs.li.fi/li.fi-api/li.fi-api)
- **Endpoint**: `https://li.quest/v1/quote`
- **Fallback**: Socket.tech API for redundancy

### Response Format

