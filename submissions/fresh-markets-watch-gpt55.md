# Fresh Markets Watch

## Related Bounty

Issue: #1 - Fresh Markets Watch

## Agent

Implementation path: `submissions/fresh-markets-watch`

The agent scans AMM factory `PairCreated` and `PoolCreated` events over a recent block window and returns newly created pairs/pools with decoded token addresses, factory/protocol metadata, block/time evidence, and transaction hashes.

## Inputs

- `chain`: currently `base` or `arbitrum`
- `factories`: optional configured factory addresses to scan
- `window_minutes`: recent time window
- optional `from_block`
- optional `to_block`

## Outputs

- `markets[]`: decoded new pair/pool events
- `warnings[]`
- `scanned`: chain, block range, and factories scanned
- `data_sources[]`
- `fetched_at`

## Accuracy Notes

This implementation uses public RPC log indexing and does not fabricate data. It decodes factory creation logs directly, which keeps false positives low for configured factories. Creation events alone do not prove initial liquidity or token-holder distribution, so `init_liquidity` is `null` and `top_holders` is `[]` unless a reliable enrichment source is added.

## Validation

```bash
cd submissions/fresh-markets-watch
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Optional live scan:

```bash
FRESH_CHAIN=base \
FRESH_WINDOW_MINUTES=10 \
npm run fresh:sample
```

## Deployment / x402

The implementation includes an Express server with `@x402/express` protection for:

- `POST /entrypoints/watch_fresh_markets/invoke`
- `POST /entrypoints/fresh-markets/invoke`
- `POST /entrypoints/markets/invoke`
- `POST /invoke`

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/fresh-markets-watch`
- Health: `https://gpt55.558686.xyz/fresh-markets-watch/health`
- Manifest: `https://gpt55.558686.xyz/fresh-markets-watch/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/fresh-markets-watch/entrypoints/watch_fresh_markets/invoke`
- Hyphenated alias: `POST https://gpt55.558686.xyz/fresh-markets-watch/entrypoints/fresh-markets/invoke`
- Short alias: `POST https://gpt55.558686.xyz/fresh-markets-watch/entrypoints/markets/invoke`
- Legacy alias: `POST https://gpt55.558686.xyz/fresh-markets-watch/invoke`

Public x402 smoke validation returned HTTP 402 with `PAYMENT-REQUIRED` for all four invoke paths. The deployed manifest advertises Base x402 (`eip155:8453`) at `$0.01` per request.

Live historical validation on Base decoded a real SushiSwap V2 `PairCreated` event:

- block: `47264078`
- pair: `0xb49425c227c48148d0f5cf9eae48e68a89c19598`
- tx: `0x4aec8920d00546b03e9c121aa17366e1791671766beefd1941cd0d245260a1c2`

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`
