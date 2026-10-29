# Submission: Perps Funding Pulse — Bounty #8

**Related issue:** [#8 — Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8)  
**Agent:** `perps-funding-pulse` v0.2.0  
**Agent source repo:** https://github.com/zwang1111/funding-pulse  
**Submitter GitHub:** zwang1111

## Live deployment

| Endpoint | Method | Payment |
|---|---|---|
| `https://funding-pulse.onrender.com/health` | GET | free |
| `https://funding-pulse.onrender.com/.well-known/agent.json` | GET | free |
| `https://funding-pulse.onrender.com/v1/funding?venues=hyperliquid&markets=BTC` | GET | free probe |
| `https://funding-pulse.onrender.com/v1/x402-status` | GET | free |
| `https://funding-pulse.onrender.com/entrypoints/funding-pulse/invoke` | POST | **x402** (unpaid → HTTP 402) |

Public deploy: Render Live. Verify unpaid POST invoke → HTTP 402.

## Agent description

Near-live perps funding agent built with `@lucid-dreams/agent-kit` + Hono. Venues: Hyperliquid + Binance USDT-M. Returns funding_rate, time_to_next, open_interest, skew + pulse_score.

## Acceptance criteria checklist

- [x] Returns funding_rate, time_to_next, open_interest, skew
- [x] Near real-time
- [x] Deployed: https://funding-pulse.onrender.com
- [x] x402 unpaid → 402 verified on public URL
- [x] GET /.well-known/agent.json discoverable
- [x] Solana receive address provided

## Solana wallet address for payment

```
Bva5dSHMcg4sf7LntZyF8SeJqniZNDsystem9gcjcBZnyeP
```

## Additional resources

- https://github.com/zwang1111/funding-pulse
