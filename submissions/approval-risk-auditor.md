# Approval Risk Auditor

## Agent Description
DeFi security agent that audits wallet token approvals, flags risky/unlimited/stale approvals, and generates revocation transaction data.

## Live Deployment
- **URL**: https://kelthos-x.cfd/agents/approval-risk-auditor/
- **Health**: https://kelthos-x.cfd/agents/approval-risk-auditor/health
- **x402 Discover**: https://kelthos-x.cfd/agents/approval-risk-auditor/x402/discover

## Acceptance Criteria
- ✅ Matches Etherscan approval data for top tokens
- ✅ Identifies unlimited and stale approvals  
- ✅ Provides valid revocation transaction data (ERC-20 approve(address,0))
- ✅ Deployed on domain and reachable via x402

## Entrypoints
| Key | Method | Description |
|-----|--------|-------------|
| `audit` | POST | Audit wallet approvals across chains |

## Example Request
```bash
curl -X POST https://kelthos-x.cfd/agents/approval-risk-auditor/audit \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0","chains":["ethereum"]}'
```

## Solana Wallet for Payment
`bc1q4cwvxtunnl2cfdcr60hq7tp3c0gdh2j0retyfq`
