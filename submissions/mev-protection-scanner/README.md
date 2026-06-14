# MEV Protection Scanner

`mev-protection-scanner` scores MEV risk for a planned trade or optional pending transaction using live public RPC signals.

It uses:

- Infura WebSocket `eth_subscribe` on `newPendingTransactions` when `INFURA_WSS_URL`, `INFURA_ETHEREUM_WSS_URL`, or `INFURA_BASE_WSS_URL` is configured
- `eth_getBlockByNumber("pending", true)` for a bounded pending transaction sample
- `eth_feeHistory` priority-fee percentiles
- optional `eth_getTransactionByHash` for a specific pending transaction

It does not require private keys, does not sign transactions, and does not broadcast transactions. If no Infura WebSocket URL is configured, it falls back to public pending-block sampling.

## Input

```json
{
  "token_in": "USDC",
  "token_out": "ETH",
  "amount_in": "10000",
  "dex": "uniswap-v2",
  "chain": "eth",
  "transaction_hash": "0x...",
  "max_pending_txs": 60
}
```

Supported chains: `eth`, `base`.

Supported DEX labels: `uniswap-v2`, `uniswap-v3`, `sushiswap`, `curve`, `balancer`, `pancakeswap`.

## Output

- `risk_score`: 0-100
- `attack_type`: `sandwich`, `front-run`, `back-run`, or `none`
- `estimated_loss_usd`
- `protection_suggestions`
- `competing_txs`
- `gas_price_percentile`
- `response_time_ms`
- `signals`
- `notes`
- `data_sources`
- `calculation_evidence`
- `confidence`

## Method

The scanner combines:

- swap-like pending calldata selectors
- high-gas competitor count
- fee-history p50/p90 spread
- Infura WebSocket pending-transaction sampling when configured
- user's gas percentile when a transaction hash is provided, otherwise p50 fee-history
- notional trade size from `amount_in`

This is designed as a pre-trade risk indicator. It returns actionable protections rather than pretending to prove that a specific private attacker will execute.

`calculation_evidence` is a deterministic scoring fixture summary. It covers no-risk, back-run, front-run, and sandwich-risk scenarios, including the expected attack type, risk score floor, gas percentile, and estimated loss behavior.

## Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
MEV_TOKEN_IN=USDC MEV_TOKEN_OUT=ETH MEV_AMOUNT_IN=10000 MEV_DEX=uniswap-v2 MEV_CHAIN=eth npm run mev:sample
```

Tests cover swap selector detection, gas percentile math, risk classification, deterministic scoring evidence, wei-to-gwei conversion, and JSON-RPC transaction normalization.

## x402

The server exposes:

- `GET /health`
- `GET /.well-known/agent.json`
- `GET /entrypoints`
- `POST /entrypoints/scan_transaction/invoke`
- `POST /entrypoints/scan-mev/invoke`
- `POST /invoke`

If `X402_PAY_TO` is set, invoke routes are protected by `@x402/express`.
