# Approval Risk Auditor

## Agent Description

The Approval Risk Auditor is an AI agent that scans wallet addresses for risky ERC-20 and NFT token approvals. It identifies unlimited approvals, stale approvals, and generates safe revocation transaction data.

## Live Deployment

- **URL**: https://approval-risk-auditor.vercel.app
- **x402 Endpoint**: https://approval-risk-auditor.vercel.app/x402

## Acceptance Criteria Checklist

- [x] Matches Etherscan approval data for top tokens
- [x] Identifies unlimited and stale approvals
- [x] Provides valid revocation transaction data
- [x] Deployed on a domain and reachable via x402

## Solana Wallet Address

`YourSolanaWalletAddressHere`

## Technical Details

### Inputs
- `wallet` - Wallet address to audit
- `chains` - Chains to scan

### Outputs
- `approvals[]` - List of all approvals found
- `risk_flags` - Risk indicators for each approval
- `revoke_tx_data[]` - Transaction data to revoke approvals

### Implementation

The agent uses the following approach:
1. Queries blockchain APIs (Etherscan, Alchemy, or similar) for Approval events
2. Filters for active approvals where allowance > 0
3. Classifies risk based on:
   - Unlimited approvals (allowance = type(uint256).max)
   - Stale approvals (older than 90 days with no recent activity)
   - High-value approvals
4. Generates ERC-20 `approve(spender, 0)` or `approve(spender, 0)` transaction data for revocation

### API Usage

The agent exposes an x402-compatible endpoint that accepts POST requests with the wallet and chains parameters.

## Additional Resources

- [Etherscan API](https://docs.etherscan.io/)
- [ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)