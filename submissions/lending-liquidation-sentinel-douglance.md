# Lending Liquidation Sentinel

Related bounty: #9

## Agent

Lending Liquidation Sentinel monitors Aave V3 account data and supplied lending
positions for liquidation risk. It returns health factor, liquidation price,
safety buffer, threshold alerts, protocol account data, deterministic simulated
position output, source metadata, and confidence.

## Live Deployment

- Agent URL: https://lending-liquidation-sentinel.doug-lance.workers.dev
- Manifest: https://lending-liquidation-sentinel.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `monitor-liquidation`
- Invoke path: `POST /entrypoints/monitor-liquidation/invoke`

The deployment is reachable via x402. Unpaid invokes return HTTP 402 with
base-sepolia USDC payment requirements.

## Source

https://github.com/douglance/lending-liquidation-sentinel

## Supported Inputs

```json
{
  "wallet": "0x0000000000000000000000000000000000000000",
  "protocol_ids": ["aave-v3"],
  "positions": [
    {
      "collateral_symbol": "ETH",
      "collateral_amount": 1,
      "collateral_price_usd": 2000,
      "debt_symbol": "USDC",
      "debt_amount": 1550,
      "debt_price_usd": 1,
      "liquidation_threshold": 0.8
    }
  ],
  "chain": "ethereum",
  "alert_health_factor": 1.2
}
```

Supported chains:

- `ethereum`
- `base`

Supported protocols:

- `aave-v3`

## Output Summary

The agent returns:

- `health_factor`
- `liq_price`
- `buffer_percent`
- `alert_threshold_hit`
- `protocol_accounts[]`
- `simulated_positions`
- `alert_threshold`
- `notes[]`
- `data_sources`
- `confidence`

## Acceptance Criteria Coverage

- Uses live JSON-RPC data through viem public clients.
- Reads Aave V3 `Pool.getUserAccountData(wallet)` on Ethereum and Base.
- Computes deterministic supplied-position health factor, liquidation price, buffer, and alert state.
- Fires alerts before health factor crosses 1.0 using configurable `alert_health_factor`.
- Supports test accounts and fixtures through explicit `positions[]`.
- Reports protocol/source metadata and confidence.
- Deployed on a public domain and reachable via x402.

## Validation

Local validation:

```text
npm run build
npm test
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Direct live RPC smoke against Ethereum Aave V3 plus supplied near-liquidation position:

```json
{
  "health_factor": 1.0323,
  "liq_price": 1937.5,
  "buffer_percent": 3.23,
  "alert_threshold_hit": true,
  "protocol_accounts": 1,
  "confidence": 1
}
```

Live endpoint checks:

```text
curl -fsS https://lending-liquidation-sentinel.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://lending-liquidation-sentinel.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes monitor-liquidation and x402 payments metadata

curl -i -X POST https://lending-liquidation-sentinel.doug-lance.workers.dev/entrypoints/monitor-liquidation/invoke \
  -H 'content-type: application/json' \
  -d '{"input":{"wallet":"0x0000000000000000000000000000000000000000","protocol_ids":["aave-v3"],"positions":[{"collateral_symbol":"ETH","collateral_amount":1,"collateral_price_usd":2000,"debt_symbol":"USDC","debt_amount":1550,"debt_price_usd":1,"liquidation_threshold":0.8}],"chain":"ethereum","alert_health_factor":1.2}}'
-> HTTP 402 with x402 payment requirements
```

## Payout Wallet

Solana: `EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
