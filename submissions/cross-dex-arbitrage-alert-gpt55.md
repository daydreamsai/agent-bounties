# Cross DEX Arbitrage Alert

## Related Bounty

Issue: #2 - Cross DEX Arbitrage Alert

## Agent

Implementation path: `submissions/cross-dex-arbitrage-alert`

The agent detects cross-DEX token price spreads using live V2-style factory and pair reserve reads. It accounts for DEX fee tiers and estimated swap gas, and returns `best_route`, `alt_routes`, `net_spread_bps`, and `est_fill_cost`.

Unlike price-API-only implementations, quotes are derived from on-chain reserves via public RPC. DefiLlama prices are only used to convert gas cost to USD/token-out terms.

The agent also performs a reverse reserve quote before reporting an opportunity. A single-direction output difference is not reported as `best_route` unless the estimated round trip returns more `token_in` than it started with after fees/gas.

## Inputs

- `token_in`: EVM input token address
- `token_out`: EVM output token address
- `amount_in`: decimal amount to quote
- `chains`: chains to scan, currently `base` and `eth`
- `threshold_bps`: minimum net spread to report
- `max_routes`: maximum ranked opportunities to return

## Outputs

- `best_route`
- `alt_routes`
- `net_spread_bps`
- `est_fill_cost`
- `quotes`
- `warnings`
- `data_sources`
- `confidence`

## Validation

```bash
cd submissions/cross-dex-arbitrage-alert
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
ARB_TOKEN_IN=0x4200000000000000000000000000000000000006 ARB_TOKEN_OUT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 ARB_AMOUNT_IN=1 ARB_CHAINS=base npm run arb:sample
```

Local validation on 2026-06-14:

- `npm run build` passed
- `npm test` passed, 6/6 tests
- `npm run lint` passed
- `npm audit --audit-level=moderate` passed, 0 vulnerabilities
- Live Base WETH/USDC sample returned two on-chain reserve quotes from SushiSwap V2 Base and PancakeSwap V2 Base at block `0x2d1fec0`, with gas converted through DefiLlama prices. It correctly returned `best_route=null` because the reverse round-trip check was not profitable even though a large one-way quote spread existed.

## Deployment / x402

Public deployment:

- Base URL: `https://gpt55.558686.xyz/cross-dex-arbitrage-alert`
- Health: `https://gpt55.558686.xyz/cross-dex-arbitrage-alert/health`
- Manifest: `https://gpt55.558686.xyz/cross-dex-arbitrage-alert/.well-known/agent.json`
- Invoke: `POST https://gpt55.558686.xyz/cross-dex-arbitrage-alert/entrypoints/detect_arbitrage/invoke`

Deployment validation on 2026-06-14:

- Server-side `npm run build`, `npm test`, `npm run lint`, and `npm audit --audit-level=moderate` passed
- Beijing-server live sample returned two Base reserve quotes and `confidence=0.85`
- `GET https://gpt55.558686.xyz/cross-dex-arbitrage-alert/health` returned HTTP 200
- `GET https://gpt55.558686.xyz/cross-dex-arbitrage-alert/.well-known/agent.json` returned HTTP 200
- Unpaid invoke returned HTTP 402 with a `payment-required` header
- `cross-dex-arbitrage-alert` is present in `https://gpt55.558686.xyz/.well-known/x402`

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`
