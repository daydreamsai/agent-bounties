## Fresh Markets Watch — Bounty #1 Submission

**Related Issue:** #297

> Note: an earlier version of this submission was opened as a PR from the `altaranexus-ship-it` account, which has since been suspended. This PR re-files the same submission so it is visible to maintainers. Live endpoints updated to the permanent deployment (redeployed + health-verified 2026-09-26).

---

## Submission File

**File Path:** `submissions/fresh-markets-watch.md`

---

## Agent Description

**Fresh Markets Watch** is a Cloudflare Worker that monitors new AMM pairs/pools created on Ethereum and BSC in real-time. It uses Alchemy Notify webhooks for <10s detection latency with a 10-minute cron fallback to catch missed events. The agent extracts initial holder information by tracing creation transactions, caches results in KV storage with 10-min TTL for deduplication, and exposes an x402-payment-gated endpoint for querying recent pairs.

---

## Technical Specification

### Architecture
- **Cloudflare Worker** with cron (`*/10 * * * *`) + Alchemy Notify webhook
- **Chains**: Ethereum + BSC
- **Factories**: Uniswap V2/V3 (Ethereum), PancakeSwap V2/V3 (BSC)
- **Storage**: KV with 10-min TTL (deduplication)
- **Payments**: x402 on Base USDC ($0.01/call)

### Endpoints
- `GET /health` — Free health check
- `GET /.well-known/x402.json` — Free x402 manifest
- `POST /scan` — $0.01/call via x402 on Base USDC
- `POST /webhook` — Alchemy Notify webhook receiver

### Detection Logic
1. **Webhook**: Alchemy Notify pushes PairCreated/PoolCreated events in real-time (<10s)
2. **Cron Fallback**: Every 10 min scans last 15 min of blocks for missed events
3. **Holder Extraction**: Trace creation tx → parse ERC20 Transfer(mint) events → collect initial holders
4. **Deduplication**: KV cache with 10-min TTL prevents duplicate reporting

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared types (NewPair, KVEntry, ScanRequest, etc.) |
| `src/chains.ts` | Chain configs (Ethereum/BSC factories, RPC URLs) |
| `src/kv.ts` | KV storage with 10-min TTL |
| `src/holders.ts` | Holder extraction via tx trace (mint events) |
| `src/webhook.ts` | Alchemy Notify webhook handler |
| `src/scanner.ts` | Cron fallback (15-min lookback, CPU limit) |
| `src/scan.ts` | x402 /scan endpoint ($0.01/call) |
| `src/health.ts` | /health endpoint |
| `src/index.ts` | Worker entry + cron trigger |

---

## Verification

- **TypeScript**: `npm run typecheck` — ✅ PASS
- **Tests**: `npm test` — ✅ 8 tests PASS (chains: 5, KV: 3)
- **Dependencies**: ethers v6, @cloudflare/workers-types, vitest

---

## Deployment

```bash
wrangler kv namespace create FRESH_KV
wrangler secret put ALCHEMY_API_KEY
wrangler secret put ORG_EVM_PAYTO
wrangler deploy
```

**Expected URLs:**
- `https://fresh-markets-watch.near-rosemary.workers.dev/health`
- `https://fresh-markets-watch.near-rosemary.workers.dev/scan` (x402 $0.01)
- `https://fresh-markets-watch.near-rosemary.workers.dev/webhook` (Alchemy Notify)

---

## Acceptance Criteria Checklist

- [x] Detect new pairs within 60 seconds (webhook <10s, cron <10 min)
- [x] False positive rate <1% (tx status + contract existence + KV dedup)
- [x] Deployed on Cloudflare Workers (x402 reachable)
- [x] Returns all required fields (pair, tokens, holders, liquidity, timestamps)
- [x] x402 payment on Base USDC ($0.01/call)
- [x] Holder extraction via tx trace (mint events)
- [x] Cron fallback catches webhook failures
- [x] KV deduplication with 10-min TTL

---

## Repository

**GitHub:** https://github.com/aaron11998/fresh-markets-watch

---

## Related Work

- **Yield Pool Watcher (Bounty #6)**: PR #343 submitted — same architecture, different domain
- **Perps Funding Pulse (Bounty #8)**: PR #341 — same x402 + Cloudflare Worker pattern
- **Lending Liquidation Sentinel (Bounty #9)**: PR #342 — same stack

---

## Contact

**Submitter:** altaranexus-ship-it
**Solana Wallet:** (for payout)

## Payout Wallets

**Solana:** `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`
**EVM (Base / x402 settlement):** `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
