# Perps Funding Pulse Submission

## Agent Description

Perps Funding Pulse is an AI agent that fetches live funding metrics for perpetual futures markets across major exchanges. It provides real-time funding rates, time to next funding payment, open interest, and long/short skew ratios.

## Live Deployment

- **URL**: `https://perps-funding-pulse.vercel.app`
- **x402 Payment Required**: Yes - agent is reachable via x402 protocol

## Features

- Fetches current funding rates from multiple perpetuals venues (Binance, Bybit, dYdX, Hyperliquid)
- Returns time until next funding payment
- Reports total open interest per market
- Calculates long/short skew ratio
- Real-time or near real-time data updates

## API Endpoints

### `POST /entrypoints/funding`

Fetch funding metrics for specified markets.

**Input:**
