# Approval Risk Auditor Agent

## Overview
**Agent Name:** Approval Risk Auditor
**Description:** A security-focused DeFi AI agent that scans a user's wallet for potentially dangerous token approvals (e.g. unlimited ERC20 allowances or `setApprovalForAll` NFT permissions) and identifies stale contracts. It automatically builds the specific revocation transaction payloads ready to be signed.
**Author:** @allornothingai

## Links
- **Live Deployment Link:** https://approval-risk-auditor.loca.lt/x402/agent (Reachable via x402 payment protocol)
- **Source Code:** Provided in `src/` directory of this PR.

## Acceptance Criteria Checklist
- [x] Identifies unlimited and stale approvals (Detects approvals older than 1 year and MAX_UINT256 thresholds).
- [x] Provides valid revocation transaction data (Dynamically encodes `approve(address, 0)` and `setApprovalForAll(address, false)` calldata using `viem` ABIs).
- [x] Must be deployed on a domain and reachable via x402 (Express API wrapper listening for requests).

## Payment Details
**Bounty Issue:** Resolves [#5](https://github.com/daydreamsai/agent-bounties/issues/5)
**Solana Wallet Address:** `3hLpMvUUS685bZz2PzR6vWeA37UrdKq924s7yLMB47eZ`

## Technical Details
Built using:
- `@lucid-dreams/agent-kit`
- `viem` (for ABI calldata encoding)
- `zod`
- `express`

The agent receives a `wallet` address and an array of `chains`. It queries block explorer APIs to parse the state of all active approvals. It applies a heuristics engine to flag unlimited approvals and inactive contracts, generating a `risk_score`. Most importantly, it calculates the precise `revoke_tx_data` required to neutralize the threat, which a frontend can inject directly into MetaMask/WalletConnect.
