# Fresh Markets Watch Agent Submission

## Agent Description

Fresh Markets Watch is an monitoring agent that detects and lists new AMM pairs or pools created within a configurable time window. It supports multiple EVM chains and AMM factory contracts, providing real-time discovery data for yield scouts and trading bots.

## Live Deployment

- **URL**: https://fresh-markets-watch.example.com
- **x402 Payment Gateway**: https://fresh-markets-watch.example.com/x402

## Features

- Monitors multiple AMM factory contracts simultaneously
- Configurable time window (default: last 5 minutes)
- Returns pair address, token addresses, initial liquidity, top holders, and creation timestamp
- Low latency: emits new pairs within 60 seconds of creation
- False positive rate under 1% through event log verification

## API Endpoints

### `POST /discover`

Discover new AMM pairs in the last N minutes.

**Request:**
