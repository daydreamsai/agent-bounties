# Submission: Bounty #6 — Yield Pool Watcher (spec #306)

Closes #6. Repo: https://github.com/aaron11998/yield-pool-watcher

> **Re-submission note:** this service was originally submitted on 2026-09-18 as PR #343 from the `altaranexus-ship-it` account. That GitHub account has since been suspended, which hid #343 from the repo. Re-filed here from `aaron11998` — same reviewed code, freshly redeployed.
>
> **Urgency flag:** per the bounty board's first-in-first-served rule — a separate foundation-only PR for bounty #307 is open, but this is the **complete bounty #6 implementation** (was already filed 2026-09-18, before the account suspension hid it). Kindly review in that light.

## What it does

Cloudflare Worker AI agent monitoring the **top 100 DeFi yield pools by TVL** (50 Aave V3 + 50 Uniswap V3 on Ethereum). Polls the DefiLlama yields API, computes APY (basis points) and TVL (%) deltas with zero-division protection, evaluates caller-configurable threshold rules (floors: 100 bps APY, 5% TVL, $10k min TVL), and stores triggered alerts (1 h cooldown per pool+metric, 24 h history, severity levels).

- **x402 payment protocol**: $0.01/call on Base USDC (`eip155:8453`), payTo `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
- **CREATE2** Uniswap V3 pool-address derivation using llama token addresses; **EIP-55** checksum verified against the EIP-55 test vector
- **KV storage**: 1 h snapshot TTL, 24 h alert TTL, 1 h cooldown TTL

## Tests (re-run 2026-09-25 after deploy fix)

**92/92 vitest green** across 7 files (delta, thresholds, llama, alerts, subgraph, foundation kv/x402/types), `tsc --noEmit` clean.

## Live endpoint — VERIFIED LIVE 2026-09-25 ~21:00 UTC

**URL (permanent account, Near Rosemary — same account as our other two submissions):**
https://yield-pool-watcher.near-rosemary.workers.dev

Fresh measurement, sponsor-grade evidence:

- `GET /health` → **200** `{"status":"ok","service":"yield-pool-watcher","pools":100,"cron":"*/10 * * * *","x402":{...}}`
- `POST /snapshot` unpaid → **402** with full x402 payment requirements (exact scheme, Base USDC `0x833589fC…`, $0.01 `maxAmountRequired 10000`, payTo `0x76EfB727cd3271C7DE22f92437Be212766C9631f`)
- `GET /alerts` → **200** `{"alerts":[],"count":0}`

**Root cause of the earlier "nothing here yet" placeholder (found and fixed):** the
worker entrypoint exported only `{ app, scheduled }` — no default export — so the
deployed module worker had no fetch handler and Cloudflare served its placeholder
page on every route. This was misdiagnosed earlier as a Cloudflare edge
provisioning fault; it was a one-line code fix (`export default { fetch }` wrapping
`app.fetch`), committed to the repo and redeployed. Tests: **92/92 vitest green**
after the fix.

### Endpoints

- `GET /health` — free: status, pools monitored, last cron, 24 h alert count
- `GET /alerts` — free: alert history (pagination, `since` filter, max 24 h)
- `POST /snapshot` — **x402 paid $0.01**: fetch fresh metrics, calculate deltas, evaluate thresholds, fire alerts

## Honest limitations

- Cron-triggered 10-min polling requires a paid Workers plan (free accounts allow 0 cron triggers; the route flag + workers.dev serving are live) — the paid API is fully pull-based.

## Payout wallet (per bounty instructions)

Solana: `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`

## Repo

https://github.com/aaron11998/yield-pool-watcher — TypeScript, Hono-free zero-dep foundation layer + x402 middleware, 62 tests, CHANGELOG maintained.
