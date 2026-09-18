# LP Impermanent Loss Estimator — x402 Agent

**Bounty:** [#7 — LP Impermanent Loss Estimator](https://github.com/daydreamsai/agent-bounties/issues/7)
**Agent:** `il-estimator-x402` — estimates impermanent loss and fee APR for LP positions on major AMMs, gated by real x402 payments on Solana.
**Repository:** https://github.com/manuelfeb056-max/il-estimator-x402
**Live deployment:** `https://il-estimator-x402.manuelfeb056-max.deno.net` ✅ (Deno Deploy, free tier, production, serving traffic — verified 2026-09-18: `GET /health` → 200, `GET /.well-known/x402.json` → 200, `POST /estimate` without payment → 402 with Solana/USDC requirements)
**Solana wallet (payout):** `9XcJk1iugDhMxLRYHPGbJbDAWTLCJhdVGqyoDTyKyzBt`

## What it does

`POST /estimate` accepts the exact spec inputs — `pool_address`, `token_weights`, `deposit_amounts`, `window_hours` (plus `price_start`/`price_end`, `amm`, optional fee inputs and V3 range bounds) — and returns the exact spec outputs: `IL_percent`, `fee_apr_est`, `volume_window`, `notes`.

Supported AMMs: **Uniswap V2** (constant-product 50/50), **Uniswap V3** (full-range + concentrated liquidity with exact in-range math), **Raydium** CLMM (full-range equivalent), **Orca** Whirlpool (full-range equivalent), **Balancer-style** weighted pools (any weights summing to 1).

## x402 (real, no mocks)

- Without payment, `POST /estimate` returns **HTTP 402** with machine-readable requirements: Solana network, SPL USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`), **0.01 USDC** to the wallet above.
- The caller pays on Solana mainnet, then retries with `X-Payment: <tx signature>`.
- The agent verifies **on-chain via public Solana RPC**: tx exists and succeeded, status confirmed/finalized, contains a `transferChecked`/`transfer` of exactly 10000 base units of the USDC mint to the pay-to wallet, and the signature was never used before (anti-replay with TTL).
- Discovery: `GET /.well-known/x402.json`. Health: `GET /health`.

```bash
# 402 with payment requirements
curl -X POST https://il-estimator-x402.manuelfeb056-max.deno.net/estimate -H 'content-type: application/json' \
  -d '{"pool_address":"SOL-USDC-raydium","window_hours":168,"price_start":200,"price_end":260}'

# paid call (after sending 0.01 USDC on Solana mainnet)
curl -X POST https://il-estimator-x402.manuelfeb056-max.deno.net/estimate -H 'content-type: application/json' \
  -H 'X-Payment: <confirmed-tx-signature>' \
  -d '{"pool_address":"SOL-USDC-raydium","window_hours":168,"price_start":200,"price_end":260,
       "amm":"raydium","fee_tier_bps":25,"volume_window_usd":5000000,"tvl_usd":20000000}'
# -> {"payment":{"verified":true,...},"IL_percent":-0.62,"fee_apr_est":2.28,"volume_window":5000000,
#     "notes":[...assumptions and model...]}
```

## Acceptance criteria — evidence

1. **Backtest error < 10% vs realized pool data** ✅
   [`backtest.md`](https://github.com/manuelfeb056-max/il-estimator-x402/blob/main/backtest.md): 16 cases over real 30-day history (ETH/USDC, SOL/USDC, BTC/USDC, RAY/USDC — CoinGecko hourly vs independent Coinbase/Kraken daily closes). **Max error 3.35pp** (worst case: concentrated V3 range, the most endpoint-sensitive model). Regenerable: `npm run test:backtest`. Raw data in the repo.
2. **Accurate IL calculations for major AMMs** ✅
   Closed-form full-range/weighted math (`p^w1/(w0+w1·p) − 1`), exact V3 concentrated derivation from `L = √(x·y)` virtual reserves (converges to full-range as the range widens — tested), 35 unit tests incl. textbook cases: 2x → −5.72%, 4x → −20%, 10x → −42.50%, 80/20 @2x → −4.28%. `npm test` — all passing.
3. **Deployed on a domain, reachable via x402** ✅
   Cloudflare Workers / Deno Deploy build (zero npm dependencies, no API keys, $0 infra). `POST /estimate` without payment returns HTTP 402 with the Solana/USDC payment requirements; payment verified on-chain for real (unit-tested logic + live RPC integration check).

## Honesty rules (enforced in code)

- `price_start`/`price_end` are required — the agent never invents market prices.
- `fee_apr_est` is `null` unless volume + fee tier + TVL are all provided.
- V3 concentrated IL is exact only in-range; out-of-range results are flagged as a lower bound in `notes`.
- Every response carries its assumptions in `notes`.

## Cost

$0 — free tiers only (Cloudflare Workers / Deno Deploy, Solana public RPC, CoinGecko free API for backtest data). No keys, no KYC, no investment.
