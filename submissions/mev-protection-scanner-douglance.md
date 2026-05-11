# MEV Protection Scanner

Related bounty: #45

## Agent

MEV Protection Scanner estimates sandwich/front-run risk for AMM trade intent
using live pending-block and fee-history signals, then returns a risk score,
attack classification, estimated loss, competing transaction count, gas
percentile, confidence, and actionable protection suggestions.

## Live Deployment

- Agent URL: https://mev-protection-scanner.doug-lance.workers.dev
- Manifest: https://mev-protection-scanner.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `scan-transaction`
- Invoke path: `POST /entrypoints/scan-transaction/invoke`

The deployment is reachable via x402. Unpaid invokes return HTTP 402 with
base-sepolia USDC payment requirements.

## Source

https://github.com/douglance/mev-protection-scanner

## Supported Inputs

```json
{
  "token_in": "ETH",
  "token_out": "USDC",
  "amount_in": "10",
  "dex": "uniswap-v2",
  "chain": "ethereum"
}
```

Optional:

```json
{
  "transaction_hash": "0x..."
}
```

Supported chains:

- `ethereum`
- `base`

Supported DEX values:

- `uniswap-v2`
- `uniswap-v3`
- `sushiswap`
- `curve`

## Output Summary

The agent returns:

- `risk_score`
- `attack_type`
- `estimated_loss_usd`
- `protection_suggestions[]`
- `competing_txs`
- `gas_price_percentile`
- `confidence`
- `data_sources`

## Acceptance Criteria Coverage

- Uses live JSON-RPC pending block data through `eth_getBlockByNumber("pending", false)`.
- Uses live `eth_feeHistory` reward samples to estimate gas-price percentile.
- Looks up a supplied pending transaction hash via `eth_getTransactionByHash`.
- Detects sandwich/front-run risk from trade size, DEX route, pending block crowding, gas percentile, and pending transaction visibility.
- Returns actionable protection suggestions such as private transaction routing, tighter slippage, order splitting, and RFQ/intent routes.
- Local scoring tests cover high-risk sandwich and low-risk no-attack cases.
- Deployed on a public domain and reachable via x402.

## Validation

Local validation:

```text
npm run build
npm test
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Direct live RPC smoke against Ethereum:

```json
{
  "risk_score": 60,
  "attack_type": "front-run",
  "estimated_loss_usd": 132,
  "competing_txs": 103,
  "gas_price_percentile": 68,
  "confidence": 0.85,
  "data_sources": {
    "chain": "ethereum",
    "chain_id": 1,
    "pending_block": "ok",
    "fee_history": "ok",
    "transaction_lookup": "not_requested",
    "pending_block_base_fee_wei": "0x1f2e964e",
    "reward_sample_count": 59
  }
}
```

Live endpoint checks:

```text
curl -fsS https://mev-protection-scanner.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://mev-protection-scanner.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes scan-transaction and x402 payments metadata

curl -i -X POST https://mev-protection-scanner.doug-lance.workers.dev/entrypoints/scan-transaction/invoke \
  -H 'content-type: application/json' \
  -d '{"input":{"token_in":"ETH","token_out":"USDC","amount_in":"10","dex":"uniswap-v2","chain":"ethereum"}}'
-> HTTP 402 with x402 payment requirements
```

## Payout Wallet

Solana: `EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
