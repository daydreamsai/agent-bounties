# Bridge Route Pinger Submission

## Agent Description

The Bridge Route Pinger is an cross-chain bridge routing agent that provides real-time fee and time estimates for token transfers across blockchain networks. It integrates with the Li.Fi API to fetch live bridge route quotes, ensuring accurate and up-to-date information for users looking to move assets between chains.

## Live Deployment

- **URL:** `https://bridge-route-pinger.vercel.app`
- **x402 Endpoint:** `https://bridge-route-pinger.vercel.app/x402`

## Repository

- **GitHub:** `https://github.com/your-username/bridge-route-pinger`

## Technology Stack

- **Framework:** Node.js with Express
- **Agent Kit:** @lucid-dreams/agent-kit
- **Bridge Data:** Li.Fi API (v1)
- **Deployment:** Vercel
- **Payment:** x402 protocol

## Features

- Fetch live bridge routes from Li.Fi API
- Return multiple viable routes with fee and time estimates
- Support for major chains (Ethereum, Polygon, Arbitrum, Optimism, BSC, Avalanche, Base, etc.)
- Real-time USD fee estimation
- ETA in minutes for each route
- Requirements detection (gas tokens, approvals, etc.)

## API Endpoints

### `POST /x402`

Main x402-compliant entrypoint for the agent.

### `POST /get-routes`

Direct API endpoint for fetching bridge routes.

**Request Body:**
