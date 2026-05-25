# Perps Funding Pulse Submission

## Agent Description

Perps Funding Pulse is an AI agent that fetches real-time perpetuals funding data from major cryptocurrency exchanges. The agent provides current funding rates, time to next funding payment, open interest, and long/short skew ratios for specified perpetual futures markets.

## Live Deployment

- **URL:** https://perps-funding-pulse.vercel.app
- **x402 Endpoint:** https://perps-funding-pulse.vercel.app/x402

## Repository

https://github.com/your-username/perps-funding-pulse

## Features

- Fetches live funding rates from multiple perpetuals venues (Binance, Bybit, OKX, dYdX, Hyperliquid)
- Returns time until next funding payment
- Provides total open interest per market
- Calculates long/short skew ratio
- Real-time or near real-time data updates
- Deployed with x402 payment integration

## API

### Endpoint: `POST /x402`

**Headers:**
- `Content-Type: application/json`
- `X-Payment-Required: true` (x402 payment flow)

**Request Body:**
