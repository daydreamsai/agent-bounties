# Perps Funding Pulse

## Agent Description

**Perps Funding Pulse** fetches live funding rate, next-payment countdown, open interest, and long/short skew for perpetuals markets across Hyperliquid and dYdX v4.

- **Entrypoint:** `POST /entrypoints/funding/invoke`
- **Inputs:** `venue_ids`, `markets[]`
- **Outputs:** `summary[]`, `all_venues[]`, `fetched_at`

Each result includes: `funding_rate`, `funding_rate_annualized`, `time_to_next_sec`, `open_interest_usd`, `skew` (LONG_HEAVY / SHORT_HEAVY / NEUTRAL), `skew_premium_pct`, `oracle_price`.

Supported venues: Hyperliquid, dYdX v4 (public APIs, no auth required).

## Live Link

**Deployment URL:** https://perps-funding-pulse.netlify.app

- Entrypoints: https://perps-funding-pulse.netlify.app/entrypoints
- Invoke: `POST` https://perps-funding-pulse.netlify.app/entrypoints/funding/invoke

## x402 Proof

```bash
curl -X POST https://perps-funding-pulse.netlify.app/entrypoints/funding/invoke \
  -H "Content-Type: application/json" -d '{}'
```

Returns HTTP **402** with x402 payment requirements on `base-sepolia`.

## Source

https://github.com/idan57570idan-svg/perps-funding-pulse

## Acceptance Criteria

- [x] Meets all technical specifications from issue #8
- [x] Deployed on a permanent domain (perps-funding-pulse.netlify.app)
- [x] Reachable via x402 — returns HTTP 402 with payment requirements
- [x] Matches venue UI data within acceptable tolerance (live API data, <1s latency)
- [x] Real-time or near real-time data updates (no caching)
- [x] Built with @lucid-dreams/agent-kit + paymentsFromEnv (base-sepolia)

## Solana Wallet

**Wallet Address:** *(to be provided)*

## Technical Stack

- Runtime: Node.js 22 (Netlify Functions)
- Agent Kit: @lucid-dreams/agent-kit v0.2.24
- Hyperliquid: Public REST API — metaAndAssetCtxs (no auth)
- dYdX v4: Public Indexer API — perpetualMarkets (no auth)
- x402: paymentsFromEnv with base-sepolia facilitator
- Deployment: Netlify Functions (serverless, always-on)

## Closes

Fixes #8
