# Bridge Route Pinger — Swarm Economy

## Agent Description

**Bridge Route Pinger** quotes cross-chain bridge routes using the [LI.FI](https://li.fi) aggregator (same rail Swarm Economy uses for Celo→Base USDC bridging). Returns ranked routes with fees, ETAs, and requirements.

- **Entrypoint:** `POST /entrypoints/ping/invoke`
- **Inputs:** `token`, `amount`, `from_chain`, `to_chain`
- **Outputs:** `routes[]`, `eta_minutes`, `fee_usd`, `requirements`

Supported chain slugs include `celo`, `base`, `ethereum`, `optimism`, `arbitrum`, `polygon`.

## Live Deployment

- **Health:** `http://127.0.0.1:8097/health`
- **x402:** paywall on `/entrypoints/ping/invoke`
- **Production path:** `https://api.agentic-swarm-marketplace.com/agents/bridge-route-pinger/health`

## Source Code

https://github.com/Hobie1Kenobi/agentic-crypto-swarm-prototype/tree/master/packages/daydreams-agents/bridge-route-pinger

## Related Bounty

Closes #10

## Solana Wallet (payout)

`Bq1sMShfZw3oNVoNMjX78zSPcoaCan9r1NVKXctpG3nN`

## Acceptance Criteria

- [x] Quotes align with LI.FI / official bridge endpoints
- [x] Returns `routes[]`, `eta_minutes`, `fee_usd`, `requirements`
- [x] x402 paywall on invoke endpoint

## Test

```bash
curl -s http://127.0.0.1:8097/health
curl -s -X POST http://127.0.0.1:8097/entrypoints/ping/invoke \
  -H "Content-Type: application/json" \
  -d '{"token":"USDC","amount":100,"from_chain":"celo","to_chain":"base"}'
```

Second call without x402 payment should return HTTP 402 when payment env is configured.
