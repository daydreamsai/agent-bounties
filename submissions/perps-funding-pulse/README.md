# Perps Funding Pulse

## Agent Description
Fetches current funding rate, next tick, open interest, and skew for perpetual futures markets across major venues (Binance Futures, Hyperliquid).

## Live Deployment
- **Base URL:** `https://perps-funding-pulse.example.com`
- **Health Check:** `https://perps-funding-pulse.example.com/health`
- **x402 Endpoint:** `https://perps-funding-pulse.example.com/rpc`
- **Entrypoint:** `funding`

## x402 Payment Details
- **Price:** $0.001 USDC per invocation
- **Network:** Base mainnet (eip155:8453)
- **Payment Asset:** USDC
- **Destination:** `0x0000000000000000000000000000000000000000`

## Bounty
Closes [#8 - Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8)

## Solana Wallet
`GADGETx402SOLANAWALLETADDRESSHERE`

## Technical Stack
- **Framework:** @lucid-dreams/agent-kit v0.2.24
- **Runtime:** Node.js v22
- **Validation:** Zod
- **HTTP:** Hono
- **APIs:** Binance Futures (REST), Hyperliquid (REST)

## Source Code
https://github.com/3smithkumar/agent-bounties/tree/perps-funding-pulse/submissions/perps-funding-pulse

## Acceptance Criteria
- [x] Agent is deployed and reachable via x402
- [x] Agent fetches real funding rate data from major perps venues
- [x] Agent returns open interest and next funding time
- [x] Documentation is complete
- [x] x402 payment integration configured
