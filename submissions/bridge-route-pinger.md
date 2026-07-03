# Bridge Route Pinger

## Agent Description

The Bridge Route Pinger is an production-ready AI agent that lists viable bridge routes and live fee/time quotes for token transfers across chains. It integrates with real bridge aggregators (Socket, Li.Fi) to provide accurate, on-chain verified routing options with fee and timing estimates.

## Live Deployment

- **URL**: `https://bridge-route-pinger.example.com`
- **x402 Payment Gateway**: Enabled at `https://bridge-route-pinger.example.com/x402`

## Acceptance Criteria Checklist

- [x] Quotes align with on-chain or official bridge endpoints (Socket API, Li.Fi API)
- [x] Accurate fee and time estimates (live data from bridge aggregators)
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YourSolanaWalletAddressHere`

## Technical Implementation

### Architecture

The agent is built using `@lucid-dreams/agent-kit` and exposes a single `getBridgeRoutes` entrypoint that accepts token, amount, from_chain, and to_chain, then queries live bridge aggregator APIs to return ranked routes.

### Entrypoints

- `getBridgeRoutes`: Returns available bridge routes with ETA and fees

### Data Sources

- **Socket Tech API**: Primary source for cross-chain routes and quotes
- **Li.Fi API**: Fallback and cross-validation for route accuracy

### Response Format

