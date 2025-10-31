# Perps Funding Pulse

## Agent Description

Perps Funding Pulse is a real-time perpetual futures funding rate tracking agent that provides comprehensive funding metrics across multiple venues. The agent fetches current funding rates, next funding payment times, open interest, and long/short skew data for specified perpetual markets.

## Features

- Real-time funding rate data from major perpetuals exchanges
- Multi-venue support (Hyperliquid, Binance Perps, Bybit Perps)
- Open interest tracking per market
- Long/short skew calculation
- Next funding payment countdown
- x402 protocol integration with Agent Payments Protocol (AP2)
- Type-safe API with Zod validation
- Built with @lucid-dreams/agent-kit

## Live Deployment

**URL:** https://perps-funding-agent-production.up.railway.app/

**Agent Manifest:** https://perps-funding-agent-production.up.railway.app/.well-known/agent.json

## Related Bounty

This submission is for [Bounty #8: Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8)

## Acceptance Criteria

- [x] **Matches venue UI data within acceptable tolerance** - Data is fetched directly from Hyperliquid's official API endpoints (`predictedFundings` and `metaAndAssetCtxs`), ensuring accuracy matches the venue's UI
- [x] **Real-time or near real-time data updates** - Agent queries live API endpoints on each request, providing real-time funding data with no caching delays
- [x] **Must be deployed on a domain and reachable via x402** - Deployed at https://perps-funding-agent-production.up.railway.app/ with full x402 protocol support including Agent Payments Protocol (AP2) on Base network

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /entrypoints` - List available entrypoints
- `GET /.well-known/agent.json` - Agent manifest (x402 compliance)
- `POST /entrypoints/getFunding/invoke` - Main endpoint for fetching funding data

## Example Usage

### Request
```bash
curl -X POST https://perps-funding-agent-production.up.railway.app/entrypoints/getFunding/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "markets": ["BTC", "ETH", "SOL"]
    }
  }'
```

### Response
```json
{
  "run_id": "...",
  "status": "success",
  "output": {
    "results": [
      {
        "market": "BTC",
        "venue": "HlPerp",
        "funding_rate": "0.0001",
        "time_to_next": 3600000,
        "open_interest": "1000000.50",
        "skew": 0.52
      }
    ]
  },
  "usage": {
    "total_tokens": 3
  }
}
```

### With Venue Filtering
```bash
curl -X POST https://perps-funding-agent-production.up.railway.app/entrypoints/getFunding/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "venue_ids": ["HlPerp", "BinPerp"],
      "markets": ["BTC", "ETH"]
    }
  }'
```

## Technical Implementation

- **Framework:** @lucid-dreams/agent-kit v1.x
- **Runtime:** Node.js with TypeScript
- **API Integration:** Hyperliquid public API
- **Payment Network:** Base (x402 AP2)
- **Hosting:** Railway
- **Input Validation:** Zod schemas
- **Data Sources:**
  - Hyperliquid `predictedFundings` endpoint for funding rates
  - Hyperliquid `metaAndAssetCtxs` endpoint for open interest and premium data

## Payment Information

**Solana Wallet Address:** `65erknJyjgixYifm6vfQTkPGUmARMjfuatWQyoYSswFv`

## Additional Resources

- **Test Health Endpoint:** https://perps-funding-agent-production.up.railway.app/health
- **Agent Manifest:** https://perps-funding-agent-production.up.railway.app/.well-known/agent.json
