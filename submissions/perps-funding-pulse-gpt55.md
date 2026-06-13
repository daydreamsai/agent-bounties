# Perps Funding Pulse

## Related Bounty

Issue: #8 - Perps Funding Pulse

## Agent

Implementation path: `submissions/perps-funding-pulse`

The agent fetches near real-time perpetual futures funding data from Hyperliquid by default, with optional Binance USD-M Futures and Bybit linear perps support when the deployment network can reach those APIs. It normalizes current funding rate, funding bps, next funding tick, time to next funding, open interest, USD open interest where available, mark/index price, and venue-supported long/short skew.

## Inputs

- `venue_ids`: `hyperliquid`, `binance`, and/or `bybit`
- `markets[]`: markets such as `BTC`, `ETH`, `SOL`, or `BTCUSDT`
- optional `include_raw`

## Outputs

- `metrics[]`: funding and open-interest metrics per venue/market
- `warnings[]`: unavailable market or venue-specific field notes
- `data_sources[]`
- `fetched_at`

## Accuracy Notes

This implementation uses official public venue APIs and does not fabricate missing fields. Binance provides public long/short account ratio as a skew proxy. The selected Hyperliquid and Bybit public endpoints expose funding and open interest but not equivalent public skew, so those rows return `skew: null` with warnings. The deployed default is Hyperliquid because it is consistently reachable from the current host; Binance and Bybit are supported as caller-requested optional venues.

## Validation

```bash
cd submissions/perps-funding-pulse
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Optional live scan:

```bash
PERPS_VENUE_IDS=hyperliquid \
PERPS_MARKETS=BTC,ETH,SOL \
npm run pulse:sample
```

## Deployment / x402

The implementation includes an Express server with `@x402/express` protection for:

- `POST /entrypoints/get_funding_pulse/invoke`
- `POST /entrypoints/funding-pulse/invoke`
- `POST /entrypoints/perps/invoke`
- `POST /invoke`

Planned public deployment path:

- Base URL: `https://gpt55.558686.xyz/perps-funding-pulse`

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`
