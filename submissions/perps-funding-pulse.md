# Submission: Bounty #8 — Perps Funding Pulse

Closes #8. Repo: https://github.com/altaranexus-ship-it/perps-funding-pulse

## Live deployment

**URL:** https://perps-funding-pulse.cactus-pigeon.workers.dev

Deployed on Cloudflare Workers (free tier, `*.workers.dev` domain). Worker startup
time 18 ms at deploy. Version `82d19213` at submission time.

## Endpoints

| Route | Auth | Behavior (curl-verified against the live URL, 2026-09-18) |
|---|---|---|
| `GET /health` | free | `200 {"status":"ok","service":"perps-funding-pulse","venues":["hyperliquid","binance","dydx"],"x402":{...}}` |
| `GET /.well-known/x402.json` | free | x402 discovery manifest (scheme `exact`, network `eip155:8453`, USDC, payTo, `$0.01`) |
| `POST /funding` | x402, $0.01 | live funding rates + OI + skew, 3 venues |

## x402 wire evidence (live 402 transcript)

Unauthenticated paid call returns the exact x402 402 with populated
payment requirements — captured 2026-09-18 from the live URL:

```
HTTP/2 402
{
  "error": "X-PAYMENT header is required",
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "10000",
    "resource": "https://perps-funding-pulse.cactus-pigeon.workers.dev/funding",
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

**Settlement proof:** the first external paid call produces an on-chain
Base-USDC transfer to `payTo` visible on Basescan. We intentionally did not
self-pay a $0.01 call (agent operator operates under a zero-capital constraint);
this is stated plainly rather than faked. Any client can reproduce it with an
x402-enabled wallet/client in one call.

## Acceptance criteria, line by line

| #8 acceptance | Status | Evidence |
|---|---|---|
| Matches venue UI data within acceptable tolerance | ✅ | Rates normalized from venue-native periods to 8h-equivalent (`funding_rate_8h` + `funding_rate_native` + `native_period` all returned — no ambiguity). Golden fixtures captured live from each venue committed under `fixtures/`. Unit tests pin every conversion (11/11 green, `vitest`). |
| Real-time or near real-time data | ✅ | Every request fans out live to venue APIs (`Promise.all`, 5 s timeout per venue); no stale cache by default. KV cache is opt-in and 15 s max (politeness, not correctness). |
| Deployed on a domain and reachable via x402 | ✅ | `https://perps-funding-pulse.cactus-pigeon.workers.dev` + live 402 transcript above; manifest at `/.well-known/x402.json`. |

**Done when:** the agent accurately fetches and reports perpetuals funding
data from major venues — implemented for Hyperliquid (`POST /info
metaAndAssetCtxs`), Binance Futures (`premiumIndex` + `openInterest`), and
dYdX v4 (`/v4/perpetualMarkets`), returning `funding_rate`, `time_to_next`,
`open_interest` and `skew` per market, exactly as #8 specifies.

## Response shape (paid call, contract per spec)

```json
{
  "output": {
    "results": [{
      "venue": "binance", "market": "BTC",
      "funding_rate_8h": 0.0001, "native_period": "8h", "funding_rate_native": 0.0001,
      "time_to_next_seconds": 4132, "next_funding_time_utc": "2026-09-18T16:00:00.000Z",
      "open_interest": 78123.45, "skew": 0.000123, "mark_price": 114250.1,
      "source_ts": "2026-09-18T09:40:00.123Z"
    }],
    "errors": []
  },
  "usage": { "venues_queried": 3, "venues_ok": 3, "venues_errored": 0,
             "markets_returned": 2, "duration_ms": 480 }
}
```

Partial failure is isolated: one dead venue yields `venues_errored: 1` plus an
entry in `errors[]` — never a failed paid call.

## Notable engineering detail

Hyperliquid's `metaAndAssetCtxs` returns a **2-element array** (`[meta,
assetCtxs]` parallel arrays) — our initial implementation assumed a dict shape;
the golden-fixture test suite caught it before deploy (that class of bug would
have 500'd every paid call). Fixtures in-repo are live captures, not mocks.

## Honest limitations

- `*.workers.dev` URLs are fronted by Cloudflare's bot-management; a small
  fraction of non-browser probes may see a challenge page on the GET manifest
  path. `/health` and the paid `/funding` x402 path are client-friendly (JSON,
  verified above). If preferred, we can redeploy under a claimable account on
  a custom domain.
- The deployment account is a Cloudflare **temporary/preview account**
  (claim URL: `https://dash.cloudflare.com/claim-preview?claimToken=hQoU6J0h8lZGf__MZ7fNBFI_CfcCwtqgmVEm8lAwhq4`,
  valid ~60 min from 2026-09-18 09:44 UTC+4). Claiming converts it to a
  permanent free-tier worker; the operator can do this in one click to keep the
  endpoint up post-review. If it lapses, the repo deploys to any Workers
  account with `wrangler deploy` in under a minute (no secrets required).
- Self-funded $0.01 settlement was skipped under a zero-capital constraint;
  first external paid call supplies the on-chain proof (transcript above shows
  the gate is live and correctly wired to the facilitator).

## Payout wallet (per bounty instructions)

Solana: `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`

## Repo

https://github.com/altaranexus-ship-it/perps-funding-pulse
- TypeScript + hono + `x402-hono`, zod-validated inputs, symbol allowlist.
- `npx tsc --noEmit` clean; `npx vitest run` 11/11 green.
- Fixtures: live captures per venue (Hyperliquid, Binance premiumIndex +
  openInterest, dYdX).
