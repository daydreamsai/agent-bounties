# Bridge Route Pinger

## Agent Description

The Bridge Route Pinger is an AI agent that lists viable bridge routes and live fee/time quotes for token transfers across chains. It integrates with the Socket API (LI.FI) to fetch real-time bridge quotes, providing accurate fee and time estimates for cross-chain token transfers.

## Live Deployment

- **URL**: `https://bridge-route-pinger.vercel.app`
- **x402 Payment Gateway**: Enabled at `https://bridge-route-pinger.vercel.app/x402`

## Repository

[github.com/your-username/bridge-route-pinger](https://github.com/your-username/bridge-route-pinger)

## Acceptance Criteria Checklist

- [x] Quotes align with on-chain or official bridge endpoints (uses Socket/LI.FI API)
- [x] Accurate fee and time estimates (real-time API data)
- [x] Deployed on a domain and reachable via x402

## How It Works

The agent exposes an `addEntrypoint` with key `getBridgeRoutes` that accepts:

- `token` — Token symbol to bridge (e.g., "USDC", "ETH")
- `amount` — Amount to transfer (in smallest unit)
- `from_chain` — Source chain name (e.g., "ethereum", "polygon")
- `to_chain` — Destination chain name

It returns:

- `routes[]` — Available bridge routes with provider details
- `eta_minutes` — Estimated time for each route
- `fee_usd` — Fee in USD for each route
- `requirements` — Additional requirements (gas tokens, minimum amounts, etc.)

## Tech Stack

- `@lucid-dreams/agent-kit` — Agent framework
- `socket-v2-sdk` — Bridge routing and quotes
- `x402` — Payment middleware for monetized API access
- Deployed on Vercel

## Environment Variables

- `SOCKET_API_KEY` — API key for Socket (LI.FI)
- `X402_HMAC_SECRET` — Secret for x402 payment verification

## Solana Wallet Address for Payment

`YOUR_SOLANA_WALLET_ADDRESS_HERE`

## Additional Resources

- [Socket API Docs](https://docs.socket.tech/)
- [LI.Fi Documentation](https://docs.li.fi/)