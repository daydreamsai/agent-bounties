# Perps Funding Pulse - Submission

## Agent Description

Perps Funding Pulse is an AI agent that fetches live funding metrics for perpetual futures markets across major exchanges. It provides real-time funding rates, time to next funding payment, open interest, and long/short skew data.

## Live Deployment

- **URL**: `https://perps-funding-pulse.example.com` (replace with actual deployment URL)
- **x402 Payment Endpoint**: `https://perps-funding-pulse.example.com/x402`

## Features

- Query multiple perpetuals exchanges (Binance, Bybit, OKX, dYdX, Hyperliquid)
- Fetch current funding rates with near real-time updates
- Calculate time until next funding payment
- Report total open interest per market
- Compute long/short skew ratio

## API Endpoints

### GET /funding
Query parameters:
- `venue_ids` - Comma-separated list of exchange IDs
- `markets` - Comma-separated list of market symbols (e.g., BTC-USD,ETH-USD)

Returns array of funding metrics:
