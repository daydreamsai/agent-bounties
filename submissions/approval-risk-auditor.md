# Approval Risk Auditor

## Agent Description

**Approval Risk Auditor** scans a wallet's ERC-20 approval history across multiple chains, flags unlimited or risky approvals, and generates ready-to-send revocation transaction calldata.

- **Entrypoint:** `POST /entrypoints/audit/invoke`
- **Inputs:** `wallet` (EVM address), `chains[]`
- **Outputs:** `approvals[]`, `risk_flags`, `revoke_tx_data[]`

Each approval includes: `token_address`, `spender_address`, `amount_raw` (UNLIMITED or value), `is_unlimited`, `risk_level` (HIGH/MEDIUM/LOW), `block_number`.

Each revoke entry includes: `to`, `data` (encoded calldata for `approve(spender, 0)`), `description`.

Supported chains: Ethereum, Polygon, Arbitrum, Base, Optimism, BNB Chain.

## Live Link

**Deployment URL:** https://approval-risk-auditor.netlify.app

- Entrypoints: https://approval-risk-auditor.netlify.app/entrypoints
- Invoke: `POST` https://approval-risk-auditor.netlify.app/entrypoints/audit/invoke

## x402 Proof

```bash
curl -X POST https://approval-risk-auditor.netlify.app/entrypoints/audit/invoke \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'
```

Returns HTTP **402** with x402 payment requirements on `base-sepolia`.

## Source

https://github.com/idan57570idan-svg/approval-risk-auditor

## Acceptance Criteria

- [x] Meets all technical specifications from issue #5
- [x] Deployed on a permanent domain (approval-risk-auditor.netlify.app)
- [x] Reachable via x402 — returns HTTP 402 with payment requirements
- [x] Matches on-chain approval data (reads live from public RPC — no caching)
- [x] Identifies unlimited approvals (`is_unlimited: true`, `risk_level: HIGH`)
- [x] Provides valid revocation transaction data (`approve(spender, 0)` calldata)
- [x] Built with @lucid-dreams/agent-kit + paymentsFromEnv (base-sepolia)

## Solana Wallet

**Wallet Address:** BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef

## Technical Stack

- Runtime: Node.js 22 (Netlify Functions)
- Agent Kit: @lucid-dreams/agent-kit v0.2.24
- On-chain data: viem getLogs — Approval events from public RPC endpoints (no API key)
- Revoke calldata: viem encodeFunctionData — `approve(spender, 0)`
- x402: paymentsFromEnv with base-sepolia facilitator
- Deployment: Netlify Functions (serverless, always-on)

## Closes

Fixes #5
