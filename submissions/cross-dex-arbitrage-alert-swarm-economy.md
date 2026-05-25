# Cross DEX Arbitrage Alert — Swarm Economy

## Agent Description

**Cross DEX Arbitrage Alert** scans Uniswap V2-style DEX venues on Base (and Base Sepolia) for token price spreads after DEX fees and gas. Returns the best quote route, alternatives, net spread in basis points, and estimated fill cost.

- **Entrypoint:** `POST /entrypoints/scan/invoke`
- **Inputs:** `token_in`, `token_out`, `amount_in`, `chains`, `min_net_spread_bps` (optional)
- **Outputs:** `best_route`, `alt_routes`, `net_spread_bps`, `est_fill_cost`, `profitable`

## Live Deployment

- **Health:** `http://127.0.0.1:8104/health`
- **x402:** paywall on `/entrypoints/scan/invoke`
- **Production path:** `https://api.agentic-swarm-marketplace.com/agents/cross-dex-arbitrage-alert/health`

## Source Code

https://github.com/Hobie1Kenobi/agentic-crypto-swarm-prototype/tree/master/packages/daydreams-agents/cross-dex-arbitrage-alert

## Related Bounty

Closes #2

## Solana Wallet (payout)

`Bq1sMShfZw3oNVoNMjX78zSPcoaCan9r1NVKXctpG3nN`

## Acceptance Criteria

- [x] V2 reserve quotes across multiple Base DEX factories (BaseSwap, SushiSwap, PancakeSwap)
- [x] Spread and cost calculations include 0.3% DEX fees and live gas estimates
- [x] Returns `best_route`, `alt_routes`, `net_spread_bps`, `est_fill_cost`
- [x] x402 paywall on invoke endpoint

## Test

```bash
curl -s http://127.0.0.1:8104/health
curl -s -X POST http://127.0.0.1:8104/entrypoints/scan/invoke \
  -H "Content-Type: application/json" \
  -d '{"token_in":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","token_out":"0x4200000000000000000000000000000000000006","amount_in":"1000000000","chains":["base"]}'
```
