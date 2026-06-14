# Lending Liquidation Sentinel

## Related Bounty

Issue: #9 - Lending Liquidation Sentinel

## Agent

Implementation path: `submissions/lending-liquidation-sentinel`

The agent monitors Aave V3 account health by reading `Pool.getUserAccountData(wallet)` over public RPC and returns liquidation risk fields for supported protocols.

## Inputs

- `wallet`: EVM wallet address
- `protocol_ids`: `aave-v3-base` and/or `aave-v3-arbitrum`
- optional `positions[]`: single-position metadata for liquidation price calculation
- optional `alert_threshold`

## Outputs

- `positions[]`: health factor, buffer percent, alert flag, collateral/debt USD, available borrow USD, liquidation threshold, and notes
- `warnings[]`
- `data_sources[]`
- `fetched_at`

## Accuracy Notes

This implementation uses real Aave V3 Pool contract data. It does not fabricate liquidation prices from aggregate account data. `liq_price` is only calculated when the caller supplies enough single-position data: collateral amount, debt amount, debt price, and liquidation threshold.

## Validation

```bash
cd submissions/lending-liquidation-sentinel
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Optional live scan:

```bash
SENTINEL_WALLET=0x0000000000000000000000000000000000000001 \
SENTINEL_PROTOCOL_IDS=aave-v3-base \
npm run sentinel:sample
```

## Deployment / x402

The implementation includes an Express server with `@x402/express` protection for:

- `POST /entrypoints/monitor_liquidation/invoke`
- `POST /entrypoints/liquidation/invoke`
- `POST /entrypoints/monitor/invoke`
- `POST /invoke`

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/lending-liquidation-sentinel`
- Health: `https://gpt55.558686.xyz/lending-liquidation-sentinel/health`
- Manifest: `https://gpt55.558686.xyz/lending-liquidation-sentinel/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/lending-liquidation-sentinel/entrypoints/monitor_liquidation/invoke`
- Short liquidation alias: `POST https://gpt55.558686.xyz/lending-liquidation-sentinel/entrypoints/liquidation/invoke`
- Monitor alias: `POST https://gpt55.558686.xyz/lending-liquidation-sentinel/entrypoints/monitor/invoke`
- Legacy alias: `POST https://gpt55.558686.xyz/lending-liquidation-sentinel/invoke`

Public x402 smoke validation returned HTTP 402 with `PAYMENT-REQUIRED` for all four invoke paths. The deployed manifest advertises Base x402 (`eip155:8453`) at `$0.01` per request.

Live validation on Base Aave V3 against `0x0000000000000000000000000000000000000001` returned a real on-chain `getUserAccountData` response with zero collateral/debt and infinite health factor represented as `health_factor: null`.

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`
