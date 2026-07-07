# Perps Funding Pulse

**Bounty:** [Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8)
**Agent Name:** perps-funding-pulse
**Version:** 0.1.0

## Description

Perps Funding Pulse is an AI agent that fetches live funding metrics for perpetual futures markets across major exchanges. It provides real-time funding rates, time to next funding payment, open interest, and long/short skew ratios.

## Live Deployment

- **URL:** https://perps-funding-pulse.vercel.app
- **x402 Payment Endpoint:** https://perps-funding-pulse.vercel.app/x402

## Features

- Fetches current funding rates from multiple perpetuals exchanges (Binance, Bybit, dYdX, Hyperliquid)
- Returns time until next funding payment
- Reports total open interest per market
- Calculates long/short skew ratio
- Real-time or near real-time data updates
- Accessible via x402 payment protocol

## API

### Entrypoint: `getFundingMetrics`

**Input:**
