# Approval Risk Auditor

## Agent Details
- **Name**: approval-risk-auditor
- **Version**: 0.1.0
- **Description**: Flag unlimited or stale ERC-20 / NFT approvals
- **Deployment URL**: https://bounty5-auditor-production.up.railway.app
- **Repository**: https://github.com/ShivanshKandpal/bounty5-auditor
- **Pricing**: 0.03 USDC per request (x402)

## Bounty Issue
This submission addresses: https://github.com/daydreamsai/agent-bounties/issues/5

## Technical Implementation
- **Framework**: @lucid-dreams/agent-kit v0.2.22
- **Server**: @hono/node-server v1.19.5
- **Blockchain Library**: ethers v6.15.0
- **Data Source**: Covalent API (@covalenthq/client-sdk v2.3.4)
- **Payment Protocol**: x402 via base-sepolia network
- **Risk Detection**: 
  - Unlimited approvals (allowance === "UNLIMITED")
  - Stale approvals (>365 days since last update)
- **Multi-chain Support**: Processes multiple chains in parallel
- **Transaction Generation**: Encodes revoke transactions using ethers.js
  - ERC-20: `approve(spender, 0)`
  - NFT: `setApprovalForAll(operator, false)`

## Acceptance Criteria
- ✅ Identifies unlimited and stale approvals across multiple chains
- ✅ Provides valid revocation transaction data with proper encoding
- ✅ Deployed on Railway domain with HTTPS
- ✅ Reachable via x402 payment protocol (0.03 USDC per request)
- ✅ Returns structured data matching specification (approvals[], risk_flags[], revoke_tx_data[])

## API Endpoints
- **Manifest**: `GET /.well-known/agent-card.json`
- **Audit Entrypoint**: `POST /entrypoints/audit/invoke`

## Input Schema
```json
{
  "wallet": "string (wallet address or ENS)",
  "chains": ["string (array of chain names)"]
}
```

## Output Schema
```json
{
  "approvals": ["array of approval objects"],
  "risk_flags": ["array of risk indicators"],
  "revoke_tx_data": ["array of transaction data"]
}
```

## Verification
Test the agent manifest:
```bash
curl https://bounty5-auditor-production.up.railway.app/.well-known/agent-card.json
```

Test x402 payment requirement (should return 402 Payment Required):
```bash
curl -i https://bounty5-auditor-production.up.railway.app/entrypoints/audit/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"wallet":"0xtest","chains":["eth-mainnet"]}}'
```

Expected response: HTTP 402 with payment details including:
- Network: base-sepolia
- Price: 0.03 USDC
- Payee: 0xb308ed39d67D0d4BAe5BC2FAEF60c66BBb6AE429
- Facilitator: https://facilitator.daydreams.systems

## Solana Wallet
DwaXJZwQmyCkhEpQSnw7TEzuxgKido6uNJVhinoJtaCX
