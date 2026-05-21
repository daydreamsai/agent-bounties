# Perps Funding Pulse — Volcanic Signal Agent

**Bounty**: [#8 - Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8)

**Submitted by**: Volcanic Lab

---

## TL;DR

A production-grade Perps Funding Pulse agent supporting **5 venues** with structured signals (summary, skew, confidence, top opportunities). Deployed on stable mainnet infrastructure with real USDC x402 payments.

---

## Live Agent

- **Endpoint**: https://volcanic-signal-agent.45.132.242.18.sslip.io
- **Manifest**: https://volcanic-signal-agent.45.132.242.18.sslip.io/.well-known/agent.json
- **Entrypoint**: `/entrypoints/perps-funding-pulse/invoke`
- **Payment**: 0.05 USDC on Base mainnet

**Wallet**: `0x19F494B4EFCfe9A7b8EfbF1313161E8ecB43A79b`

---

## Key Features

- 5-venue coverage: Hyperliquid, OKX, dYdX, Binance, Bybit
- Structured output with `summary`, `skew_signal`, `confidence`, and `top_opportunities`
- Transparent heuristic skew signal with documented limitations
- Overview mode for quick market pulse
- Stable self-hosted deployment on Base mainnet

---

## Why This Submission

- More venues than most existing submissions
- Significantly more structured and actionable output
- Real mainnet deployment (not testnet)
- Honest and transparent about limitations
- Working manifest and clean verification steps

---

## Verification

1. Check manifest:  
   `curl https://volcanic-signal-agent.45.132.242.18.sslip.io/.well-known/agent.json`

2. Test unpaid invoke (returns 402):  
   `curl -X POST .../invoke -d '{"overview": true}'`

3. Full documentation and example outputs available in the [detailed submission draft](https://github.com/daydreamsai/agent-bounties/pull/XXX).

---

## Built With

- Lucid Agents (Daydreams) + Hono
- Bun runtime
- Self-hosted VPS with Caddy + systemd

---

## Payment Address

**Base USDC**: `0x19F494B4EFCfe9A7b8EfbF1313161E8ecB43A79b`

---

*This agent is ready for review and has been running stably since deployment.*