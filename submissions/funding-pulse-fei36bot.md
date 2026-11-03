# Submission: Perps Funding Pulse — Bounty #8

**Related issue:** [#8 — Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8)  
**Agent:** `perps-funding-pulse` v0.1.0  
**Agent source repo:** https://github.com/fei36bot/perps-funding-pulse  
**Submitter GitHub:** fei36bot

## Live deployment

| Endpoint | Method | Payment |
|---|---|---|
| `https://dir-disc-profiles-templates.trycloudflare.com/health` | GET | free |
| `https://dir-disc-profiles-templates.trycloudflare.com/.well-known/agent.json` | GET | free |
| `https://dir-disc-profiles-templates.trycloudflare.com/entrypoints/funding-pulse/invoke` | POST | **x402** (unpaid → HTTP 402) |

Public deploy: Cloudflare Tunnel (`*.trycloudflare.com`). Verified unpaid POST invoke → HTTP 402 with `payTo` = EVM wallet below (network `base-sepolia`, price `0.01` USDC).

## Agent description

Near-live perps funding agent built with `@lucid-dreams/agent-kit` + Hono. Venues: Hyperliquid, Binance, Bybit. Returns `funding_rate`, `time_to_next`, `open_interest`, `skew`.

## Acceptance criteria checklist

- [x] Returns funding_rate, time_to_next, open_interest, skew
- [x] Near real-time venue APIs
- [x] Deployed: https://dir-disc-profiles-templates.trycloudflare.com
- [x] x402 unpaid → 402 verified on public HTTPS URL
- [x] GET /.well-known/agent.json discoverable
- [x] EVM + Solana receive addresses provided

## EVM wallet address for x402 / payment

```
0xDFb67e2ed78F174e76Cf5Cfc87Ab39733f7a5c62
```

## Solana wallet address for payment

```
2NchCPMdxc8en5Wo6o6aM1PUiZG2tChd7huFB2nsYJJB
```

## Additional resources

- https://github.com/fei36bot/perps-funding-pulse
