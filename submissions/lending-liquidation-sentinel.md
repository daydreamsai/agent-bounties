# Bounty #9 Submission — Lending Liquidation Sentinel

**Worker:** `lending-liquidation-sentinel` · **Live:** https://lending-liquidation-sentinel.near-rosemary.workers.dev
**Repo:** https://github.com/aaron11998/lending-liquidation-sentinel · **Schema:** free `GET /.well-known/x402.json` · **Payment:** x402 `POST /positions` — $0.01 USDC (Base, `eip155:8453`)

> **Re-submission note:** originally submitted 2026-09-18 as PR #342 from the `altaranexus-ship-it` account. That GitHub account has since been suspended, which hid #342 from the repo. Re-filed here from `aaron11998` — same reviewed code (release commit `35ca16f`), now redeployed on a **permanent** Cloudflare account.

## What it does

Monitors Aave V3 (Base) borrower health factors and returns a liquidation-risk verdict per wallet:

- `getUserAccountData` eth_call to the canonical Aave V3 Base Pool `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` (verified live; addresses from BGD Labs `@bgd-labs/aave-address-book`).
- Derives: **health_factor**, **liquidation_collateral_usd** (collateral × weighted liquidation threshold), **buffer_percent** (drop in collateral value until liquidation), **alert** boolean vs caller-set threshold (default 1.25), plus raw values for auditability.
- No-debt wallets → `health_factor: null` (Aave `type(uint256).max` convention), `alert: false`.
- Keyless: public RPC only. Batch up to 25 wallets per paid call.

## Acceptance criteria → evidence

| Criterion | Status |
|---|---|
| Returns accurate health factors | ✅ 9/9 vitest tests; math validated against **3 live Aave Base borrowers** (HF 2.000 / 3.000 / 0.9967) read directly on-chain; no-debt → null verified live |
| Alert triggers before liquidation | ✅ strict `<` threshold incl. exactly-at-boundary case; alert fires at HF 1.25 for 1.0-position (test + live 0.9967 wallet) |
| x402 paywall | ✅ live unpaid `POST /positions` → exact 402 with `paymentRequirements` (`maxAmountRequired: 10000`, USDC `0x8335…2913`, payTo org wallet), scheme `exact`, network `base`; free `/health` + `/.well-known/x402.json`; `npx tsc --noEmit` clean |
| Live endpoint + serviceability | ✅ permanent-account deployment (2026-09-24, version `67233378-3a5d-42c5-8d77-6e0c85b8960d`); README documents redeploy (`wrangler deploy`) from repo |

## Live wire evidence (fresh, 2026-09-24)

`GET /health` → `200`:
```json
{"status":"ok","service":"lending-liquidation-sentinel","protocols":["aave-v3"],"x402":{"network":"eip155:8453","asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","price":"$0.01/call"},"defaults":{"alert_threshold":1.25}}
```

Unpaid `POST /positions` → `402`:
```json
{
  "error": "X-PAYMENT header is required",
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "10000",
    "resource": "https://lending-liquidation-sentinel.near-rosemary.workers.dev/positions",
    "description": "Aave V3 liquidation-risk check",
    "payTo": "0x76EfB727cd3271C7DE22f92437Be212766C9631f",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "extra": { "name": "USD Coin", "version": "2" }
  }],
  "x402Version": 1
}
```

## Payout wallet (per bounty instructions)

Solana: `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`
