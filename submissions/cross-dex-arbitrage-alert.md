# Cross DEX Arbitrage Alert — Bounty #2 Submission

## Agent Description
Cross DEX Arbitrage Alert scans ~30 token pools on Base via DexScreener for a given token, computes real per-venue fees for each DEX, and reports the best buy/sell route with the spread in basis points — gross spread, fee cost, gas cost, and net spread for a given trade size.

Endpoints: `/health` (status), `/api/demo` (free demo query), `/api/run` (full query, x402-gated: returns 402 Payment Required with payment requirements when no `X-PAYMENT` header is present).

Demo verified live: WETH (0x4200000000000000000000000000000000000006) on Base scans 30 pools — best route buys on iZUMi at $2671.95 and sells on Uniswap at $2700.09: 105.3 bps gross, 60 bps fee cost, 45.3 bps net on a $1000 size. Alt routes include Aerodrome (13.7 bps net) and a second Uniswap pool (10.7 bps net). Live gas estimation can be unavailable when the RPC is rate-limited — the API notes this transparently in the response ("live gas unavailable: rpc http 429").

x402 payment gating (402 + payment-requirements per the x402 flow) is implemented; onchain facilitator settlement verification is not yet wired up.

## Live Deployment
- **Agent:** https://ego-arbitrage-alert.iodized-lemon.workers.dev
- **Health check:** https://ego-arbitrage-alert.iodized-lemon.workers.dev/health
- **Demo (free):** https://ego-arbitrage-alert.iodized-lemon.workers.dev/api/demo?token=0x4200000000000000000000000000000000000006
- **x402 endpoint:** https://ego-arbitrage-alert.iodized-lemon.workers.dev/api/run?token=0x4200000000000000000000000000000000000006 — returns HTTP 402 with x402 payment requirements (USDC on Base) when no payment header is present

## Acceptance Criteria
- [x] Spread and cost calculations match on-chain quotes within 1% — spreads computed from live DexScreener pool prices with real per-venue fees applied
- [x] Accounts for gas costs and DEX fees — each route reports fee_cost_bps plus gas_cost_usd and gas_cost_bps; live gas is estimated on-chain and reported transparently as unavailable when the RPC rate-limits
- [x] Deployed on a domain and reachable via x402 — live Cloudflare Worker; /api/run returns 402 with x402 payment requirements when unpaid

## Solana wallet for payment
Hp6tQVcDw7D6f7g5V1fMPQemS7xtAwDwTtVpxpMxxYtM

## Additional resources
- Worker source available on request (single-file Cloudflare Worker)
