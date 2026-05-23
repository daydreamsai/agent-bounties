# Approval Risk Auditor — Tom Nook Hermes

## Bounty

- Related issue: #5
- Submission type: live x402-gated agent

## Live service

- Worker: https://approval-risk-auditor.tolga-730.workers.dev
- Manifest: https://approval-risk-auditor.tolga-730.workers.dev/.well-known/agent.json
- Entrypoints: https://approval-risk-auditor.tolga-730.workers.dev/entrypoints
- Canonical invoke: `POST https://approval-risk-auditor.tolga-730.workers.dev/entrypoints/audit_approvals/invoke`
- Compatibility invoke: `POST /entrypoints/audit-approvals/invoke` and `POST /invoke`

## Repository

- Source: https://github.com/tolga-tom-nook/approval-risk-auditor-agent
- Final readiness report: https://github.com/tolga-tom-nook/approval-risk-auditor-agent/blob/main/FINAL_READINESS.md
- Deployment report: https://github.com/tolga-tom-nook/approval-risk-auditor-agent/blob/main/DEPLOYMENT_REPORT.md

## Payout

- Solana payout wallet: `8sqgL8Srd7QCWJnQRFw1Gsi4spS9rndAbER1HEGDHLNT`
- x402 payTo EVM address: `0xd2475a9a1a6eC3B76e1c38F9C368084cfd98D46a`

## What the agent does

The Approval Risk Auditor scans EVM wallets for risky ERC-20 and NFT approvals and returns unsigned revoke transaction calldata. It never asks for private keys and never moves funds.

Features:

- ERC-20 approval log scanning for curated major assets across Ethereum, Base, Polygon, Arbitrum, and Optimism.
- Current `allowance(owner, spender)` validation before reporting, so already-revoked/zero allowances are ignored.
- Etherscan-compatible explorer fallback hooks for ERC-20 `Approval` logs when explorer API keys are configured.
- NFT `ApprovalForAll` discovery hooks through RPC/global logs where supported plus explorer fallback hooks.
- Risk flags for unlimited allowances, nonzero allowances, stale approvals, and NFT operator approvals.
- Revoke calldata for:
  - ERC-20: `approve(spender, 0)`
  - NFT: `setApprovalForAll(operator, false)`
- Daydreams-style discovery:
  - `GET /.well-known/agent.json`
  - `GET /entrypoints`
  - `POST /entrypoints/audit_approvals/invoke`
- Compatibility with hyphenated entrypoint clients:
  - `POST /entrypoints/audit-approvals/invoke`
- Legacy direct routes:
  - `POST /invoke`
  - `POST /audit`

## x402 behavior

When `PAYMENT_ADDRESS` is configured, protected calls require `X-PAYMENT` before audit work runs.

Unpaid protected calls return HTTP 402 with payment requirements. For example, unpaid canonical invoke returns a 402 response whose `accepts[0].resource` is:

```text
https://approval-risk-auditor.tolga-730.workers.dev/entrypoints/audit_approvals/invoke
```

The server implements facilitator-driven verification and settlement via configurable `X402_FACILITATOR_URL` using `/verify` before execution and `/settle` after a successful audit.

Important caveat: the public deployment proves x402 reachability/payment-requirement behavior. Full paid verify/settle is implemented but has not been live-tested because the expected facilitator URL/schema and exact Base USDC asset identifier need to be provided/configured.

## Verification

Latest verification on the submitted source:

```bash
npm run build
# TypeScript clean

npm test
# 3 test files passed, 20 tests passed
```

Smoke-tested live deployment:

- `GET /health` returns ok metadata.
- `GET /.well-known/agent.json` returns the manifest.
- `GET /entrypoints` includes `audit_approvals` and alias `audit-approvals`.
- Unpaid `POST /entrypoints/audit_approvals/invoke` returns HTTP 402 with x402 payment requirements.
- Unpaid `POST /entrypoints/audit-approvals/invoke` returns HTTP 402 with the same canonical x402 resource.
- Unpaid legacy `POST /invoke` returns HTTP 402.

## Notes

This submission is intentionally conservative and safety-focused: it returns unsigned transaction targets/calldata for user review and execution in their own wallet. It does not custody assets, request secrets, sign transactions, or move funds.
