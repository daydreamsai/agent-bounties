# Approval Risk Auditor Agent

## Agent Description

The Approval Risk Auditor agent scans ERC-20 token approvals for a given wallet address and identifies risky or stale approvals that pose security risks. It detects unlimited approvals, flags approvals older than 90 days, and generates revocation transaction data that can be executed to remove dangerous approvals. The agent helps users maintain security by identifying and providing tools to revoke risky token permissions.

**Key Features:**
- Queries ERC-20 Approval events for wallet address
- Detects unlimited approvals (is_unlimited flag)
- Identifies stale approvals (>90 days old, is_stale flag)
- Generates ready-to-execute revocation transaction data
- Provides risk level assessment for each approval
- Returns structured data with token, spender, amount, timestamps

## Related Bounty Issue

[#5 - Approval Risk Auditor](https://github.com/daydreamsai/agent-bounties/issues/5)

## Live Deployment

**Deployment URL:** `https://x402.haxters.com/approval-risk-auditor`

**x402 Access:** Enabled

## Acceptance Criteria

- ✅ Identifies unlimited approvals
- ✅ Detects stale approvals (>90 days)
- ✅ Generates revocation transaction data (token, spender, data, to fields)
- ✅ Returns approvals with risk_level classification
- ✅ All addresses are valid Ethereum addresses
- ✅ All tests pass (5/5 tests)

## Entrypoint

**Key:** `audit_approvals`

**Input:**
```json
{
  "wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "token_addresses": []
}
```

**Output:**
```json
{
  "approvals": [...],
  "risk_flags": [...],
  "revoke_tx_data": [...]
}
```

## Solana Wallet

**Wallet Address:** `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`

## Technical Details

- Built with `@lucid-dreams/agent-kit`
- Uses `ethers.js` to query Approval events
- Analyzes approval amounts for unlimited detection
- Calculates approval age from block timestamps
- Generates ERC-20 approval revocation calldata
- Provides comprehensive risk assessment

