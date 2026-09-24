# Approval Risk Auditor

**Related bounty:** [#5 — Approval Risk Auditor](https://github.com/daydreamsai/agent-bounties/issues/5)

## Agent Description

Audits a wallet's ERC-20 / NFT approvals and flags risky grants. Given a wallet,
chains, and an approval list (e.g. sourced from Etherscan approval data), it returns
per-approval `risk_flags` and ready-to-send `revoke_tx_data`:

- `UNLIMITED` — ERC-20 allowance equals `2^256 - 1`
- `STALE` — no approval activity for 180+ days
- `ALREADY_REVOKED` — zero allowance (no revoke tx needed)
- `NFT_OPERATOR_GRANT` — active ERC-721/ERC-1155 operator approval
- `UNKNOWN_AGE` — no usable activity timestamp

Revocation calldata: ERC-20 `approve(spender, 0)` (`0x095ea7b3…`);
NFT `setApprovalForAll(operator, false)` (`0xa22cb465…`).

Implementation: [`approval-risk-auditor/`](../approval-risk-auditor/) (dependency-free
Node.js, `POST /audit` HTTP endpoint, offline unit tests via `npm test`).

## Live Link

**Deployment URL:** TBD (local: `http://localhost:3000/audit`)

## Acceptance Criteria

- [x] Matches approval-data-driven inputs (approvals supplied from scanner/Etherscan data)
- [x] Identifies unlimited and stale approvals
- [x] Provides valid revocation transaction data
- [ ] Deployed on a domain and reachable via x402 (pending deployment)

## Other Resources

- **Repository:** this repo, `approval-risk-auditor/` directory

## Solana Wallet

**Wallet Address:** TBD

## Additional Notes

Risk analysis and revoke-calldata construction run fully offline; only the
approval inventory fetch (Etherscan or chain RPC) requires network access.
