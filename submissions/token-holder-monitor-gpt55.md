# Token Holder Monitor

## Related Bounty

Issue: #59 - Token Holder Monitor

## Agent

Implementation path: `submissions/token-holder-monitor`

The agent analyzes ERC20 holder concentration across Ethereum, Polygon, Arbitrum, Optimism, and Base. It scans live `Transfer` logs, builds candidate holder sets, verifies current balances with `balanceOf`, reports whale wallets, computes Gini/HHI/top-holder concentration metrics, and surfaces recent large transfers.

The implementation does not fabricate full holder counts. Without a privileged holder-index API, `holder_count` is marked sampled and the response includes warnings plus `holder_count_is_sampled: true`.

## Inputs

- `contract_address`: ERC20 token contract address
- `chain`: one of `ethereum`, `polygon`, `arbitrum`, `optimism`, `base`
- optional `min_holders`
- optional `lookback_blocks`
- optional `top_n`
- optional `large_transfer_threshold_bps`

## Outputs

- `holder_count`
- `holder_count_is_sampled`
- `whale_wallets[]`
- `concentration_metrics`
- `centralization_risk`
- `alerts[]`
- `large_transfers[]`
- `token_info`
- `external_checks`
- `data_sources`
- `warnings`

## Data Sources

- RPC: `Transfer` logs, `balanceOf`, `totalSupply`, `decimals`, `symbol`, `name`
- Etherscan v2: token `Transfer` logs when `ETHERSCAN_API_KEY` is configured

## Validation

```bash
cd submissions/token-holder-monitor
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Tests cover:

- Gini coefficient, HHI, and top-holder share calculation
- centralization risk and sampled-distribution alerts
- valid input/default option parsing
- invalid address and unsupported chain rejection

Current local validation:

- `npm run build` passes
- `npm test` passes 4 tests
- `npm run lint` passes
- `npm audit --audit-level=moderate` reports 0 vulnerabilities
- live sample scan against Ethereum USDC over 50 blocks observed current holders, whale balances, 3,000+ transfer logs, token metadata, and concentration metrics from real RPC data
- deployed Beijing server service is active on localhost port 8796
- public health and manifest return HTTP 200 through the gateway path
- unpaid public invokes return HTTP 402 with `PAYMENT-REQUIRED` on all protected invoke aliases

## Deployment / x402

The implementation includes an Express server with `@x402/express` protection for:

- `POST /entrypoints/monitor_token/invoke`
- `POST /entrypoints/monitor-token/invoke`
- `POST /entrypoints/holders/invoke`
- `POST /invoke`

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/token-holder-monitor`
- Health: `https://gpt55.558686.xyz/token-holder-monitor/health`
- Manifest: `https://gpt55.558686.xyz/token-holder-monitor/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/token-holder-monitor/entrypoints/monitor_token/invoke`
- Hyphenated alias: `POST https://gpt55.558686.xyz/token-holder-monitor/entrypoints/monitor-token/invoke`
- Short alias: `POST https://gpt55.558686.xyz/token-holder-monitor/entrypoints/holders/invoke`
- Legacy alias: `POST https://gpt55.558686.xyz/token-holder-monitor/invoke`

Public x402 smoke validation returned HTTP 402 with `PAYMENT-REQUIRED` for all four invoke paths. The deployed manifest advertises Base x402 (`eip155:8453`) at `$0.01` per request.

Observed service cost on the Beijing server after startup: about 45-70 MB RAM, with negligible idle CPU after the Node process is warm.

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`
