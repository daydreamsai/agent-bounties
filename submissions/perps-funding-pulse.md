# Submission: Bounty #8 — Perps Funding Pulse

Closes #8. Repo: https://github.com/aaron11998/perps-funding-pulse

> **Re-submission note:** this service was originally submitted on 2026-09-18 as PR #341 from the `altaranexus-ship-it` account. That GitHub account has since been suspended, which hid #341 from the repo. Re-filed here from `aaron11998` — same reviewed code (release commit `d99d4db`), now redeployed on a **permanent** Cloudflare account.

## Live deployment

**URL:** https://perps-funding-pulse.near-rosemary.workers.dev

Permanent Cloudflare Workers account (free tier, `*.workers.dev` domain). Redeployed 2026-09-24 (worker version `a97905d4-4cb0-4614-a647-5d04ae0f2352`).

## Endpoints

| Route | Auth | Behavior (re-verified live via curl 2026-09-24) |
|---|---|---|
| `GET /health` | free | `200 {"status":"ok","service":"perps-funding-pulse","venues":["hyperliquid","binance","dydx"],"x402":{...}}` |
| `GET /.well-known/x402.json` | free | `200` x402 discovery manifest (scheme `exact`, network `eip155:8453`, USDC, payTo, `$0.01`) |
| `POST /funding` | x402, $0.01 | live funding rates + open interest + skew across 3 venues |

## x402 wire evidence (fresh 402 transcript, 2026-09-24)

Unauthenticated paid call against the live URL returns the exact x402 402 with
populated payment requirements:

```
HTTP/2 402
{
  "error": "X-PAYMENT header is required",
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "10000",
    "resource": "https://perps-funding-pulse.near-rosemary.workers.dev/funding",
    "description": "Perps funding pulse: 3-venue funding rates, OI, skew",
    "payTo": "0x76EfB727cd3271C7DE22f92437Be212766C9631f",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "extra": { "name": "USD Coin", "version": "2" }
  }],
  "x402Version": 1
}
```

Payment verification is delegated to the official x402 facilitator
(`x402-hono` `paymentMiddleware`, network `eip155:8453` = Base mainnet).
The service holds **no private keys** — it only verifies and settles x402
payments to the payTo address; it never signs.

## Why the data is trustworthy

- Live venue APIs (Hyperliquid, Binance fapi, dYdX) are normalized through
  per-venue adapters with **zod-validated inputs** and symbol allowlists — no
  free-form passthrough (a malicious `market` string would have 500'd every
  paid call). Fixtures in-repo are live captures, not mocks.
- Test suite re-run 2026-09-24: **15/15 vitest green**, `npx tsc --noEmit` clean.

## Honest limitations

- Self-funded $0.01 settlement was skipped under a zero-capital constraint;
  the first external paid call supplies the on-chain proof (transcript above
  shows the gate is live and correctly wired to the facilitator).
- Free-tier Workers: no cron triggers — `/funding` is pull-based, which matches
  the bounty spec (`venue_ids` / `markets[]` inputs per call).

## Payout wallet (per bounty instructions)

Solana: `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`

## Repo

https://github.com/aaron11998/perps-funding-pulse
- TypeScript + hono + `x402-hono`, zod-validated inputs, symbol allowlist.
- Fixtures: live captures per venue (Hyperliquid, Binance premiumIndex +
  openInterest, dYdX). Smoke-gate tooling in `smoke/` replays fixtures end-to-end.
