# MEV Protection Scanner

## Related Bounty

Issue: #45 - MEV Protection Scanner

## Agent

Implementation path: `submissions/mev-protection-scanner`

The agent scores MEV risk for planned swaps and optional pending transactions using live public RPC pending-block, fee-history, and transaction lookup signals. It returns risk score, attack type, estimated loss, competing transaction count, gas percentile, and protection suggestions.

The implementation is intentionally honest about its data boundary: it uses public RPC real-time pending data and does not claim private Blocknative/Infura stream access unless such a provider is added externally.

## Inputs

- `token_in`
- `token_out`
- `amount_in`
- `dex`
- `chain`
- `transaction_hash` optional
- `max_pending_txs`

## Outputs

- `risk_score`
- `attack_type`
- `estimated_loss_usd`
- `protection_suggestions`
- `competing_txs`
- `gas_price_percentile`
- `response_time_ms`
- `signals`
- `notes`
- `data_sources`
- `confidence`

## Validation

```bash
cd submissions/mev-protection-scanner
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
MEV_TOKEN_IN=USDC MEV_TOKEN_OUT=ETH MEV_AMOUNT_IN=10000 MEV_DEX=uniswap-v2 MEV_CHAIN=eth npm run mev:sample
```

Local validation on 2026-06-14:

- `npm run build` passed
- `npm test` passed, 6/6 tests
- `npm run lint` passed
- `npm audit --audit-level=moderate` passed, 0 vulnerabilities
- Live Ethereum sample returned in `response_time_ms=1567` with external command elapsed time under 3 seconds, satisfying the `<3 seconds` response-time criterion.
- Live sample used `rpc:eth:pending-block` and `rpc:eth:fee-history`, sampled 20 pending transactions, returned `risk_score=75`, `attack_type=front-run`, `competing_txs=20`, and `confidence=0.9`.

## Deployment / x402

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/mev-protection-scanner`
- Health: `https://gpt55.558686.xyz/mev-protection-scanner/health`
- Manifest: `https://gpt55.558686.xyz/mev-protection-scanner/.well-known/agent.json`
- Invoke: `POST https://gpt55.558686.xyz/mev-protection-scanner/entrypoints/scan_transaction/invoke`

Public validation on 2026-06-14:

- `GET /mev-protection-scanner/health` returns HTTP 200.
- `GET /mev-protection-scanner/.well-known/agent.json` returns HTTP 200 with the public URL and x402 metadata.
- Unpaid `POST /mev-protection-scanner/entrypoints/scan_transaction/invoke` returns HTTP 402 with `payment-required`.
- `x402/live-prices.json` and `/.well-known/x402` include the `mev-protection-scanner` resource at `$0.01` on Base USDC.

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`
