## Bounty Submission

**Related Issue:** #5

---

## Submission File

**File Path:** `submissions/approval-risk-auditor-shivanshkandpal.md`

---

## Agent Description

The **Approval Risk Auditor** is an AI agent that scans wallet addresses across multiple blockchain networks to identify risky ERC-20 and NFT token approvals. It flags unlimited allowances and stale approvals (>365 days old), then generates ready-to-execute transaction data to revoke these risky permissions.

**Key Features:**
- Multi-chain support with parallel processing
- Detects unlimited ERC-20 approvals (UNLIMITED allowance)
- Identifies stale approvals across ERC-20 tokens and NFT collections
- Generates valid revocation transaction data using ethers.js encoding
- Returns structured data: approvals array, risk flags, and revoke transaction payloads
- Monetized via x402 payment protocol (0.03 USDC per request)

**Technical Stack:**
- Framework: @lucid-dreams/agent-kit v0.2.22
- Server: @hono/node-server v1.19.5
- Blockchain Library: ethers v6.15.0
- Data Source: Covalent API (@covalenthq/client-sdk v2.3.4)
- Payment Protocol: x402 on Base mainnet (0.01 USDC per request)

---

## Demo Video

**Payment Flow Demonstration:** https://drive.google.com/file/d/1VnmdEEAdvtyL6W8N5-SpIomPvcifJ6CY/view?usp=sharing

The video demonstrates:
1. Request without payment returns 402 Payment Required
2. Payment is created and processed (0.01 USDC on Base mainnet)
3. Request with payment returns 200 OK with audit results
4. Payment is verified via balance check

---

## Live Link

**Deployment URL:** https://bounty5-auditor-production.up.railway.app

**API Endpoints:**
- Manifest: `GET /.well-known/agent-card.json`
- Audit Entrypoint: `POST /entrypoints/audit/invoke`

**Test the deployment:**
```bash
# Check agent manifest
curl https://bounty5-auditor-production.up.railway.app/.well-known/agent-card.json

# Test x402 payment requirement (returns 402)
curl -i https://bounty5-auditor-production.up.railway.app/entrypoints/audit/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"wallet":"0xtest","chains":["eth-mainnet"]}}'
```

---

## Acceptance Criteria

- [x] Meets all technical specifications (wallet + chains input, returns approvals/risk_flags/revoke_tx_data)
- [x] Deployed on a domain (Railway: bounty5-auditor-production.up.railway.app)
- [x] Reachable via x402 (verified - returns 402 Payment Required with payment details)
- [x] All acceptance criteria from the issue are met:
  - [x] Identifies unlimited approvals
  - [x] Identifies stale approvals (>365 days)
  - [x] Provides valid revocation transaction data
- [x] Submission file added to `submissions/` directory

---

## Other Resources

- **Repository:** https://github.com/ShivanshKandpal/bounty5-auditor
- **Documentation:** See README.md in repository
- **Demo Video:** https://drive.google.com/file/d/1VnmdEEAdvtyL6W8N5-SpIomPvcifJ6CY/view?usp=sharing
- **Verification:**
  - Payment Network: Base mainnet
  - Pricing: 0.01 USDC per invoke
  - Payee Wallet: 0x352F99eCbB999288fC3B08E3A0042cf65d16A543
  - Facilitator: https://facilitator.daydreams.systems

---

## Solana Wallet

**Wallet Address:** DwaXJZwQmyCkhEpQSnw7TEzuxgKido6uNJVhinoJtaCX

---

## Additional Notes

### Input Schema
```json
{
  "input": {
    "wallet": "string (wallet address or ENS name)",
    "chains": ["array of chain names, e.g., 'eth-mainnet', 'polygon-mainnet'"]
  }
}
```

### Output Schema
```json
{
  "approvals": ["array of approval objects with token details"],
  "risk_flags": ["array of risk indicators (unlimited/stale) parallel to approvals"],
  "revoke_tx_data": ["array of transaction objects with to/data/value fields"]
}
```

### Implementation Details
- Uses Covalent API endpoints `/approvals/` and `/nft/approvals/` for comprehensive data
- ERC-20 revokes encoded as: `approve(spender, 0)`
- NFT revokes encoded as: `setApprovalForAll(operator, false)`
- Processes multiple chains in parallel using Promise.allSettled
- Filters out failed transaction generations gracefully
- Risk detection: unlimited allowance OR last updated >365 days ago
