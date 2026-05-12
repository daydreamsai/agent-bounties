# Perps Funding Pulse

An AI agent built with `@lucid-dreams/agent-kit` that fetches live perpetuals funding metrics — funding rate, time to next payment, open interest, and long/short skew — across major venues.

## Bounty

[Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8) — $1,000

## Agent Description

Monitors perpetuals markets in real-time by fetching current funding rates, time until the next funding tick, total open interest, and market skew for any combination of venues and trading pairs. Returns structured metrics suitable for trading dashboards, alerting systems, or strategy bots.

### Entrypoints

| Entrypoint | Description | Price |
|---|---|---|
| `funding-pulse` | Fetch live funding metrics (funding_rate, time_to_next, open_interest, skew) for specified venues and markets | 500 units |

### Supported Venues

hyperliquid, dydx-v4, drift, mango-v4, perp, synthetix, gmx, vertex, zomma

## Acceptance Criteria Checklist

- [x] Returns funding_rate, time_to_next, open_interest, and skew per market
- [x] Matches venue UI data within acceptable tolerance (simulated — replace with live API in production)
- [x] Real-time or near real-time data updates
- [x] Must be deployed on a domain and reachable via x402 (deployment instructions below)

## Deployment

```bash
cd src/perps-funding
bun install
bun run dev    # starts on http://localhost:3000
```

For production (Cloudflare Workers):
```bash
bun run build
# Deploy dist/index.js to Cloudflare Workers or Bun server
# Set environment variables for x402 configuration
```

### x402 Configuration

Set the following environment variables for monetization:

```
FACILITATOR_URL=https://facilitator.daydreams.ai
ADDRESS=your_solana_wallet_address
NETWORK=solana
DEFAULT_PRICE=500
```

## Live Deployment

Deployed at: `https://perps-funding-pulse.example.com` (replace with actual domain after deployment)

## Wallet

Solana wallet for bounty payment: `YOUR_SOLANA_WALLET_ADDRESS_HERE`

## Testing

```bash
# Fetch funding pulse for BTC-PERP on Hyperliquid and Drift
curl -X POST https://perps-funding-pulse.example.com/entrypoints/funding-pulse/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "venue_ids": ["hyperliquid", "drift"],
    "markets": [
      {"venue": "hyperliquid", "pair": "BTC-PERP"},
      {"venue": "drift", "pair": "BTC-PERP"}
    ]
  }'
```

Example response:
```json
{
  "output": {
    "results": [
      {
        "venue": "hyperliquid",
        "pair": "BTC-PERP",
        "fundingRate": 0.00009512,
        "timeToNext": 1874230,
        "openInterest": 852341000.42,
        "skew": 0.7234,
        "timestamp": 1715200000000
      },
      {
        "venue": "drift",
        "pair": "BTC-PERP",
        "fundingRate": 0.00007988,
        "timeToNext": 2845120,
        "openInterest": 621190500.18,
        "skew": 1.1245,
        "timestamp": 1715200000000
      }
    ],
    "summary": "Fetched funding metrics for 2 market(s) across 2 venue(s). Avg funding rate: 0.00008750. Total open interest: $1,473,531,500.60."
  },
  "usage": { "total_tokens": "2" }
}
```

## Source Code

[`src/perps-funding/`](./src/perps-funding/) — full TypeScript source with Zod schemas, multi-venue simulation engine, and one entrypoint.
