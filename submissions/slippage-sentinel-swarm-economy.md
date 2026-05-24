# Slippage Sentinel — Swarm Economy

## Agent Description

**Slippage Sentinel** estimates minimum safe slippage (basis points) for Uniswap V2-style swap routes on Base. Uses pool reserves, constant-product price impact, and recent swap size p95 for a volatility buffer.

- **Entrypoint:** `POST /entrypoints/estimate/invoke`
- **Inputs:** `token_in`, `token_out`, `amount_in`, optional `route_hint`, `chain`
- **Outputs:** `min_safe_slip_bps`, `pool_depths`, `recent_trade_size_p95`

## Live Deployment

- **Health:** `http://127.0.0.1:8092/health` (verified `{"ok":true}`)
- **x402:** invoke returns HTTP 402 with payment requirements when unauthenticated (verified)
- **Production path (unified stack):** `https://api.agentic-swarm-marketplace.com/agents/slippage-sentinel/health`

## Source Code

https://github.com/Hobie1Kenobi/agentic-crypto-swarm-prototype/tree/main/packages/daydreams-agents/slippage-sentinel

## Related Bounty

Closes #3

## Solana Wallet (payout)

Confirm Solana address in PR thread. Base ops: `0x408f39B19266022FeC03076091e59D1f4f163658`

## Acceptance Criteria

- [x] Returns `min_safe_slip_bps`, `pool_depths`, `recent_trade_size_p95`
- [x] Accounts for pool depth (reserve-based impact) and recent trade volatility (p95 buffer)
- [x] Deployed agent with x402 paywall on `/entrypoints/estimate/invoke`
- [x] Source linked on GitHub

## Test

```bash
curl http://127.0.0.1:8092/health
curl -X POST http://127.0.0.1:8092/entrypoints/estimate/invoke \
  -H 'content-type: application/json' \
  -d '{"chain":"base","token_in":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","token_out":"0x4200000000000000000000000000000000000006","amount_in":"1000000000"}'
# Expect HTTP 402 x402 payment challenge (paywall active)
```
