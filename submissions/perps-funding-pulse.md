---
title: Perps Funding Pulse
bounty: 8
agent_repo: https://github.com/yunaremaia/perps-funding-pulse
live_url: https://perps-funding-pulse.vercel.app
solana_wallet: CLpp9dZzBhAgZ316szi67Nas4AdMN4Cp6Ldy1FRuBEzr
---

# Perps Funding Pulse

## Summary

Agent that fetches current funding rates, time to next funding payment, open interest, and long/short skew for perpetual futures markets across multiple venues.

## Venues Supported

- **HyperLiquid** — high-performance perps DEX
- **dYdX** — largest perps DEX

## TDD Methodology

Built with strict Test-Driven Development (Red-Green-Refactor):
- **RED**: Write failing test → verify it fails for the right reason
- **GREEN**: Write minimal code to pass → verify it passes
- **REFACTOR**: Clean up while keeping tests green

### Test Coverage (21 tests, 4 files)

| File | Tests | What it covers |
|------|-------|----------------|
| `funding.test.ts` | 11 | Formatting, time-to-next, skew calculation |
| `market-fetcher.test.ts` | 4 | Perps API integration (multiple venues) |
| `handler.test.ts` | 3 | Business logic (aggregation, errors, empty) |
| `agent.test.ts` | 3 | HTTP endpoint (health, invoke, error) |

## Build & Test

```bash
npm install
npx tsc --noEmit   # 0 errors
npx vitest run     # 21/21 tests pass
```

## Metrics Returned

| Field | Description |
|-------|-------------|
| `funding_rate` | Raw funding rate string from venue |
| `funding_rate_formatted` | Human-readable (e.g. "0.0100%") |
| `time_to_next` | Hours + minutes until next funding payment |
| `open_interest` | Total USD open interest |
| `skew` | Long/short ratio |

## Links

- **Source code:** https://github.com/yunaremaia/perps-funding-pulse
- **Live deployment:** https://perps-funding-pulse.vercel.app
- **Bounty issue:** #8