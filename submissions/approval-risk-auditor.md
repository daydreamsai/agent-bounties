# Bounty Submission: Approval Risk Auditor

**Related Issue:** #5

---

## Agent Description

The Approval Risk Auditor agent scans EVM wallets for active ERC-20 and NFT approvals across multiple chains. It identifies risky allowances such as unlimited approvals (MAX_UINT256) and stale approvals (inactive for > 90 days), automatically generating clean transaction data to revoke them safely.

---

## Live Link

**Deployment URL:** https://approval-risk-auditor.daydreams-bounties.xyz

---

## Acceptance Criteria

- [x] Meets all technical specifications
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] All acceptance criteria from the issue are met
- [x] Submission file added to `submissions/` directory

---

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** Built on @lucid-dreams/agent-kit

---

## Solana Wallet

**Wallet Address:** `DaydreamsBountyValidatorSolanaWalletAddress1111111`

---

## Additional Notes

Fully complies with the expected input and output schema, featuring robust guard checks and standard ERC-20 revocation payload generation.
