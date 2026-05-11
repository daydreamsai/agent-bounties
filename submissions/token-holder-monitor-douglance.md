# Token Holder Monitor

Related bounty: #59

## Agent

Token Holder Monitor scans recent ERC-20 `Transfer` logs on live EVM chains and
returns holder concentration, whale-transfer activity, centralization alerts,
top observed holders, largest transfers, source metadata, and confidence.

## Live Deployment

- Agent URL: https://token-holder-monitor.doug-lance.workers.dev
- Manifest: https://token-holder-monitor.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `monitor-token`
- Invoke path: `POST /entrypoints/monitor-token/invoke`

The deployment is reachable via x402. Unpaid invokes return HTTP 402 with
base-sepolia USDC payment requirements.

## Source

https://github.com/douglance/token-holder-monitor

## Supported Inputs

```json
{
  "token_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "chain": "ethereum",
  "lookback_blocks": 5000,
  "top_n": 10
}
```

Supported chains:

- `ethereum`
- `base`
- `polygon`
- `arbitrum`
- `optimism`

## Output Summary

The agent returns:

- `risk_score`
- `risk_level`
- `observed_holders`
- `concentration.top_1_percent`
- `concentration.top_5_percent`
- `concentration.top_10_percent`
- `concentration.gini`
- `whale_transfer_count`
- `alerts[]`
- `top_holders[]`
- `largest_transfers[]`
- `data_sources`
- `confidence`

## Acceptance Criteria Coverage

- Uses live JSON-RPC data through viem public clients.
- Reads ERC-20 metadata with `symbol`, `decimals`, and `totalSupply`.
- Scans bounded `Transfer(address,address,uint256)` logs in chunks.
- Reconstructs an observed active-holder snapshot for the requested lookback.
- Scores concentration by top holder share, top 5 share, Gini, and whale transfers.
- Flags transfers at least 1% of observed active supply.
- Reports data-source status and confidence rather than claiming full historical coverage.
- Deployed on a public domain and reachable via x402.

## Validation

Local validation:

```text
npm run build
npm test
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Direct live RPC smoke against Ethereum USDC:

```json
{
  "risk_score": 70,
  "risk_level": "high",
  "observed_holders": 10483,
  "transfer_logs": 78907,
  "confidence": 0.9999999999999999
}
```

Live endpoint checks:

```text
curl -fsS https://token-holder-monitor.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://token-holder-monitor.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes monitor-token and x402 payments metadata

curl -i -X POST https://token-holder-monitor.doug-lance.workers.dev/entrypoints/monitor-token/invoke \
  -H 'content-type: application/json' \
  -d '{"input":{"token_address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","chain":"ethereum","lookback_blocks":1000,"top_n":5}}'
-> HTTP 402 with x402 payment requirements
```

## Payout Wallet

Solana: `EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
