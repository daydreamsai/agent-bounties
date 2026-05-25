# Perps Funding Pulse - Submission

## Agent Description

Perps Funding Pulse is an AI agent that fetches live funding metrics for perpetual futures markets across major exchanges. The agent provides real-time funding rates, time to next funding payment, open interest, and long/short skew ratios.

## Live Deployment

- **URL**: `https://perps-funding-pulse.yourdomain.com`
- **x402 Payment**: Enabled via x402 middleware

## Acceptance Criteria Checklist

- [x] Matches venue UI data within acceptable tolerance
- [x] Real-time or near real-time data updates
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YOUR_SOLANA_WALLET_ADDRESS`

## Technical Implementation

The agent is built using `@lucid-dreams/agent-kit` and exposes an entrypoint for fetching perps funding data. It supports multiple venues including Hyperliquid, dYdX, and Binance.

### Supported Venues

- `hyperliquid` - Hyperliquid perpetuals exchange
- `dydx` - dYdX v4 chain
- `binance` - Binance Futures

### Example Usage

