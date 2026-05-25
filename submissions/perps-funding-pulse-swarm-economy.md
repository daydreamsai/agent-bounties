# Perps Funding Pulse — Swarm Economy

## Agent Description

**Perps Funding Pulse** returns live perpetuals funding metrics from Hyperliquid, dYdX v4, and Binance Futures (when not geo-blocked).

- **Entrypoint:** `POST /entrypoints/pulse/invoke`
- **Inputs:** `venue_ids`, `markets[]`
- **Outputs:** `funding_rate`, `time_to_next`, `open_interest`, `skew` per venue/market

## Live Deployment

- **Health:** `http://127.0.0.1:8098/health`
- **x402:** paywall on `/entrypoints/pulse/invoke`
- **Production path:** `https://api.agentic-swarm-marketplace.com/agents/perps-funding-pulse/health`

## Source Code

https://github.com/Hobie1Kenobi/agentic-crypto-swarm-prototype/tree/master/packages/daydreams-agents/perps-funding-pulse

## Related Bounty

Closes #8

## Solana Wallet (payout)

`Bq1sMShfZw3oNVoNMjX78zSPcoaCan9r1NVKXctpG3nN`

## Acceptance Criteria

- [x] Hyperliquid + dYdX (+ Binance when available) funding/OI/skew
- [x] Near real-time public venue APIs
- [x] x402 paywall on invoke endpoint

## Test

```bash
curl -s http://127.0.0.1:8098/health
npx tsx -e "import { fetchFundingPulse } from './src/venues.ts'; fetchFundingPulse({ venue_ids: ['hyperliquid','binance'], markets: ['BTC','ETH'] }).then(r=>console.log(JSON.stringify(r,null,2)));"
```
