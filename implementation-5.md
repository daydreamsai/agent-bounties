# Implementation for #5

See issue #5 for details.

## Purpose
Flag unlimited or stale ERC-20 / NFT approvals and build revoke calls.

## Specification

**Job:** Detect risky approvals and output safe revocation data.

**Inputs:**
- `wallet` - Wallet address to audit
- `chains` - Chains to scan

**Returns:**
- `approvals[]` - List of all approvals found
- `risk_flags` - Risk indicators for each approval
- `revoke_tx_data[]` - Transaction data to revoke approvals

## Acceptance Criteria
✅ Matches Etherscan approval data for top tokens  
✅ Identifi