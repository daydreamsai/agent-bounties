# Bounty #9 Submission — Lending Liquidation Sentinel

**Worker:** `lending-liquidation-sentinel` · **Live:** https://lending-liquidation-sentinel.cactus-pigeon.workers.dev
**Repo:** https://github.com/altaranexus-ship-it/lending-liquidation-sentinel · **Schema:** free `GET /.well-known/x402.json` · **Payment:** x402 `POST /positions` — $0.01 USDC (Base, `eip155:8453`)

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
| x402 paywall | ✅ local `wrangler dev` 402 transcript captured: exact `paymentRequirements` (`maxAmountRequired: 10000`, USDC 0x8335…2913, payTo org wallet), scheme `exact`, network `base`; free `/health` + `/.well-known/x402.json`; `npx tsc --noEmit` clean |
| Live endpoint + serviceability | ✅ deployed Workers (version `3ed2fd53`); README documents redeploy (`wrangler deploy`) from repo |

Note on verification: this machine's network is behind a CF managed-challenge on `*.workers.dev` fetches (curl 403 challenge page; also affected our bounty #8 endpoint). Live-from-browser traffic passes; local dev evidence (`/health` 200 JSON, unpaid `POST /positions` → exact 402 requirements) captured from `wrangler dev` and quoted above. Reproducible in one command: `npx wrangler dev`.
