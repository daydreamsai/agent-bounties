---
title: Perps Funding Pulse
bounty: 8
agent_repo: https://github.com/yunaremaia/perps-funding-pulse
live_url: https://perps-funding-pulse.vercel.app
solana_wallet: CLpp9dZzBhAgZ316szi67Nas4AdMN4Cp6Ldy1FRuBEzr
---

# Perps Funding Pulse

## Summary

Agent that fetches live funding metrics for perpetuals markets — current funding rate, time until next payment, open interest, and long/short skew.

## Implementation

### Core Logic
- **formatFundingRate** — decimal to percentage string (e.g. `0.0001` → `"0.0100%"`)
- **calcTimeToNext** — time remaining until next funding tick
- **calcSkew** — long/short OI ratio

### Venue Integration
- **HyperLiquid** — `api.hyperliquid.xyz/info` (POST, meta endpoint)

### Returns per market
- `funding_rate` — current rate as percentage string
- `time_to_next` — `{ hours, minutes }` until next payment
- `open_interest` — total open interest in USD
- `skew` — long/short ratio

## TDD Methodology

Built with strict TDD (Red-Green-Refactor). 21 tests in 4 files:

| File | Tests | Coverage |
|------|-------|----------|
| `funding.test.ts` | 11 | formatFundingRate, calcTimeToNext, calcSkew |
| `market-fetcher.test.ts` | 4 | HyperLiquid API (parse, filter, errors, unknown venue) |
| `handler.test.ts` | 3 | getFundingPulse (aggregate, unsupported, no markets) |
| `agent.test.ts` | 3 | HTTP endpoints (health, invoke, errors) |

## Build

```bash
npm install
npx tsc --noEmit   # 0 errors
npx vitest run     # 21/21 pass
```

## Example

```bash
curl -X POST /entrypoints/pulse/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"venue_ids":["hyperliquid"],"markets":["BTC","ETH"]}}'
```

## Links

- **Source:** https://github.com/yunaremaia/perps-funding-pulse
- **Live:** https://perps-funding-pulse.vercel.app
- **Bounty:** #8