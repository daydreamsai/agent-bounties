# GasRoute Oracle

## Related Bounty

Issue: https://github.com/daydreamsai/agent-bounties/issues/4

## Description

GasRoute Oracle estimates transaction cost across supported chains and
recommends the cheapest route for a swap or contract call. It reads live RPC fee
signals, computes calldata-adjusted gas cost, converts native fee to USD, and
returns busy-level and priority-fee hints.

The agent uses `@lucid-dreams/agent-kit` with x402 payments. It supports
Ethereum, Base, Arbitrum, Optimism, and Polygon with public RPC fallbacks and
optional custom RPC environment variables.

## Live Deployment

- Agent: https://gasroute-oracle.doug-lance.workers.dev
- Manifest: https://gasroute-oracle.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `POST /entrypoints/estimate-gasroute/invoke`

## Source

- Repository: https://github.com/douglance/gasroute-oracle
- Specification: https://github.com/douglance/gasroute-oracle/blob/main/SPEC.md
- Deployment notes: https://github.com/douglance/gasroute-oracle/blob/main/DEPLOY.md

## Supported Inputs

```json
{
  "chain_set": ["ethereum", "base", "arbitrum", "optimism", "polygon"],
  "calldata_size_bytes": 128,
  "gas_units_est": 120000,
  "urgency": "standard"
}
```

## Returns

- `chain`: recommended cheapest chain
- `fee_native`: estimated native-token cost
- `fee_usd`: USD conversion from live native-token price
- `busy_level`: low/medium/high network congestion
- `tip_hint`: suggested priority-fee percentile and gwei value
- `routes`: per-chain fee estimate and gas model details
- `assumptions`: model limitations and cost assumptions
- `confidence`: data-source confidence score

## Validation

Local validation:

```text
npm run build
npm test
npm run smoke:live
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Observed live checks:

```text
curl -fsS https://gasroute-oracle.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://gasroute-oracle.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes estimate-gasroute and x402/AP2 metadata

unpaid POST /entrypoints/estimate-gasroute/invoke
-> HTTP 402 with x402 payment requirements for base-sepolia
```

Direct live RPC smoke against Ethereum, Base, and Arbitrum returned 3 route
estimates, recommended Base, and confidence 0.9.

## Solana Wallet

`EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
