# GasRoute Oracle

## Related Bounty

Issue: #4 - GasRoute Oracle

## Agent

Implementation path: `submissions/gasroute-oracle`

The agent estimates live transaction cost across supported EVM chains and returns the cheapest chain for a caller-provided gas load. It reads current gas data from public/configured RPC endpoints, derives congestion from `eth_eth_feeHistory`, converts native fees to USD using CoinGecko prices, and returns the full quote set for auditability.

## Inputs

- `chain_set`: chains to consider
- `calldata_size_bytes`: transaction calldata size
- `gas_units_est`: execution gas estimate supplied by caller

## Outputs

- `chain`: cheapest recommended chain
- `fee_native`
- `fee_usd`
- `busy_level`
- `tip_hint`
- `quotes[]`: per-chain evidence and estimates
- `warnings[]`
- `data_sources[]`

## Supported Chains

- `ethereum`
- `base`
- `polygon`
- `arbitrum`
- `optimism`
- `bsc`
- `avalanche`

## Accuracy Notes

The oracle uses live `eth_eth_feeHistory` and `eth_gasPrice` fallback values, then computes:

```text
total_gas_units = gas_units_est + calldata_size_bytes * 16
fee_native = total_gas_units * (base_fee + priority_fee)
fee_usd = fee_native * native_token_usd
```

This is accurate for the supplied gas estimate under current RPC fee conditions. It does not fabricate wallet-specific execution gas or L2 sequencer fee internals beyond the public RPC gas quote. The response includes RPC host, block number, gas-used ratios, base fee, priority fee, and price source so reviewers can compare against live network conditions.

## Validation

```bash
cd submissions/gasroute-oracle
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Current local validation:

- npm run build passes
- npm test passes 8 tests
- npm run lint passes
- npm audit --audit-level=moderate reports 0 vulnerabilities
- live sample against Base, Polygon, Arbitrum, and Optimism returned real eth_eth_feeHistory quotes, block numbers, gas-used ratios, native token prices, USD estimates, and no warnings
Tests cover:

- calldata gas-unit estimation
- total fee multiplication
- fee-history priority fee hint
- busy-level classification
- input schema acceptance/rejection

## Deployment / x402

The implementation includes an Express server with `@x402/express` protection for:

- `POST /entrypoints/estimate_gas_route/invoke`
- `POST /entrypoints/gasroute/invoke`
- `POST /entrypoints/gas-route/invoke`
- `POST /invoke`

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/gasroute-oracle`
- Health: `https://gpt55.558686.xyz/gasroute-oracle/health`
- Manifest: `https://gpt55.558686.xyz/gasroute-oracle/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/gasroute-oracle/entrypoints/estimate_gas_route/invoke`
- Short alias: `POST https://gpt55.558686.xyz/gasroute-oracle/entrypoints/gasroute/invoke`
- Hyphenated alias: `POST https://gpt55.558686.xyz/gasroute-oracle/entrypoints/gas-route/invoke`
- Legacy alias: `POST https://gpt55.558686.xyz/gasroute-oracle/invoke`

Public x402 smoke validation returned HTTP 402 with `PAYMENT-REQUIRED` for all four invoke paths. The deployed manifest advertises Base x402 (`eip155:8453`) at `$0.01` per request.

Observed service cost on the Beijing server after startup: about 80 MB RSS, with negligible idle CPU after the Node process is warm.

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`