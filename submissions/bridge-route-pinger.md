# Bridge Route Pinger — Bounty #10 Submission

## Agent Description
Bridge Route Pinger aggregates live bridge quotes across three independent sources (LI.FI, Relay, deBridge), each queried separately so one API's rate limit can't take the service down.

Endpoints: `/health` (status), `/api/demo` (free demo query), `/api/run` (full query, x402-gated: returns 402 Payment Required with payment requirements when no `X-PAYMENT` header is present).

Demo verified live: 100 USDC base→eth returns 4 routes with real data — Polymer (Standard) via LI.FI (99.75 USDC out, $0.2510 fee, ~18 min), AcrossV4 via LI.FI (99.71 out, $0.2510 fee, ~1 min), Relay (99.90 out, ~$0.10 fee), deBridge (99.53 out, ~$0.47 fee, ~1 min). Per-route fields: bridge, source, destination amount, USD fee, gas cost, ETA minutes, approval flag.

x402 payment gating (402 + payment-requirements per the x402 flow) is implemented; onchain facilitator settlement verification is not yet wired up.

## Live Deployment
- **Agent:** https://ego-bridge-pinger.iodized-lemon.workers.dev
- **Health check:** https://ego-bridge-pinger.iodized-lemon.workers.dev/health
- **Demo (free):** https://ego-bridge-pinger.iodized-lemon.workers.dev/api/demo?token=usdc&amount=100&from_chain=base&to_chain=eth
- **x402 endpoint:** https://ego-bridge-pinger.iodized-lemon.workers.dev/api/run?token=usdc&amount=100&from_chain=base&to_chain=eth — returns HTTP 402 with x402 payment requirements (USDC on Base) when no payment header is present

## Acceptance Criteria
- [x] Quotes align with on-chain or official bridge endpoints — quotes are fetched live from official aggregator endpoints: LI.FI (li.quest/v1/quote), Relay, and deBridge APIs
- [x] Accurate fee and time estimates — each route returns fee_usd, gas_usd, and eta_minutes sourced from the aggregators' live estimates
- [x] Deployed on a domain and reachable via x402 — live Cloudflare Worker; /api/run returns 402 with x402 payment requirements when unpaid

## Solana wallet for payment
Hp6tQVcDw7D6f7g5V1fMPQemS7xtAwDwTtVpxpMxxYtM

## Additional resources
- Worker source available on request (single-file Cloudflare Worker)
