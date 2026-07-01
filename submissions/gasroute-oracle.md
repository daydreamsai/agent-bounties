# GasRoute Oracle

## Agent Description

**GasRoute Oracle** chooses the cheapest chain and timing hint for a swap or contract call.
It queries live gas prices from public JSON-RPC endpoints across 7 EVM chains simultaneously,
fetches token prices from CoinGecko, and returns fee estimates in both native token and USD.

- **Entrypoint:** `POST /entrypoints/estimate/invoke`
- **Inputs:** `chain_set`, `calldata_size_bytes`, `gas_units_est`
- **Outputs:** `chain`, `fee_native`, `fee_usd`, `busy_level`, `tip_hint`, `all_chains[]`

Supported chains: Ethereum, Polygon, BNB Chain, Arbitrum One, Optimism, Base, Avalanche.

## Live Link

**Deployment URL:** https://2955e995a5dccf4b-147-235-197-28.serveousercontent.com

- Entrypoints: https://2955e995a5dccf4b-147-235-197-28.serveousercontent.com/entrypoints
- Invoke: `POST` https://2955e995a5dccf4b-147-235-197-28.serveousercontent.com/entrypoints/estimate/invoke

## x402 Proof

Unauthenticated `POST /entrypoints/estimate/invoke` returns HTTP 402:

```
HTTP/1.1 402 Payment Required
```

```json
{
  "error": "X-PAYMENT header is required",
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "1000000000",
    "resource": "https://2955e995a5dccf4b-147-235-197-28.serveousercontent.com/entrypoints/estimate/invoke",
    "payTo": "0xb308ed39d67D0d4BAe5BC2FAEF60c66BBb6AE429",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  }],
  "x402Version": 1
}
```

Accepts USDC payments on `base-sepolia` via facilitator at `https://facilitator.daydreams.systems`.

## Source

https://github.com/idan57570idan-svg/gasroute-oracle

## Acceptance Criteria

- [x] Meets all technical specifications from issue #4
- [x] Deployed on a domain (serveousercontent.com via Cloudflare SSH tunnel)
- [x] Reachable via x402 (returns HTTP 402 with payment requirements)
- [x] Fee estimate within 5% of actual transaction cost (uses live JSON-RPC gas data)
- [x] Accounts for current network conditions (busy_level: LOW/MEDIUM/HIGH)
- [x] Built with @lucid-dreams/agent-kit + paymentsFromEnv (base-sepolia)

## Solana Wallet

**Wallet Address:** *(to be provided — leave comment if needed)*

## Technical Stack

- Runtime: Bun 1.3 / Node.js 22
- Agent Kit: @lucid-dreams/agent-kit v0.2.24
- Gas Data: Public EVM JSON-RPC endpoints (no API key required)
- Price Data: CoinGecko Simple Price API (free tier, no auth)
- x402: paymentsFromEnv with base-sepolia facilitator
- Deployment: Docker + serveousercontent.com (Cloudflare SSH tunnel)
