# LP Impermanent Loss Estimator — Swarm Economy

## Agent Description

**LP Impermanent Loss Estimator** computes impermanent loss and fee APR for LP positions using DefiLlama yield pool history and token price ratios (constant-product AMM model).

- **Entrypoint:** `POST /entrypoints/estimate/invoke`
- **Inputs:** `pool_address`, `token_weights`, `deposit_amounts`, `window_hours`
- **Outputs:** `IL_percent`, `fee_apr_est`, `volume_window`, `notes`

## Live Deployment

- **Health:** `http://127.0.0.1:8103/health`
- **x402:** paywall on `/entrypoints/estimate/invoke`
- **Production path:** `https://api.agentic-swarm-marketplace.com/agents/lp-il-estimator/health`

## Source Code

https://github.com/Hobie1Kenobi/agentic-crypto-swarm-prototype/tree/master/packages/daydreams-agents/lp-il-estimator

## Related Bounty

Closes #7

## Solana Wallet (payout)

`Bq1sMShfZw3oNVoNMjX78zSPcoaCan9r1NVKXctpG3nN`

## Acceptance Criteria

- [x] IL backtest vs DefiLlama `il7d` reference on ~168h windows
- [x] Constant-product IL model with configurable token weights
- [x] Fee APR estimate from DefiLlama chart APY history
- [x] x402 paywall on invoke endpoint

## Test

```bash
curl -s http://127.0.0.1:8103/health
curl -s -X POST http://127.0.0.1:8103/entrypoints/estimate/invoke \
  -H "Content-Type: application/json" \
  -d '{"pool_address":"b99bcdf5-1350-4269-981e-0e9b5cccb007","token_weights":[0.5,0.5],"deposit_amounts":[1,3000],"window_hours":168}'
```
