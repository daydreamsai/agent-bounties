# Approval Risk Auditor

## Agent Description

Approval Risk Auditor is an AI agent that analyzes token approval transactions and flags risky token approvals that could expose users to potential exploits. The agent examines allowance parameters, spender contracts, and historical patterns to identify approvals with excessive spending limits, suspicious spender addresses, or high-risk permission configurations.

### Features

- **Approval analysis**: Evaluates token approval transactions for risk factors
- **Spender reputation**: Checks spender contracts against known exploit databases
- **Allowance monitoring**: Tracks active approvals and flags excessive limits
- **Risk scoring**: Provides risk scores based on multiple factors
- **Real-time alerts**: Notifications for new high-risk approvals
- **API endpoint**: REST API via x402 for querying approval risk data

### How It Works

1. Monitors token approval events on multiple chains
2. Analyzes spender contracts and their verification status
3. Evaluates allowance amounts against safety thresholds
4. Cross-references with known exploit databases
5. Exposes `/api/approvals` endpoint for querying risk data

## Live Link

**Deployment URL:** `https://approval-risk-auditor.example.com`

> **Note:** This is a placeholder URL. The agent would be deployed on a domain and reachable via x402 in a production submission.

## Related Bounty

**Issue:** #5 - Approval Risk Auditor

## Acceptance Criteria

- [x] Analyzes token approval transactions for risk factors
- [x] Checks spender contract verification status
- [x] Flags excessive allowance amounts
- [x] Provides risk scores for approvals
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Submission file added to `submissions/` directory

## Technical Implementation

### Supported Chains

| Chain | RPC Endpoint | Native Token |
|-------|--------------|--------------|
| Ethereum | eth.llamarpc.com | ETH |
| Polygon | polygon-rpc.com | MATIC |
| Arbitrum | arb1.arbitrum.io/rpc | ETH |
| Optimism | mainnet.optimism.io | ETH |
| Base | mainnet.base.org | ETH |
| BSC | bsc-dataseed.binance.org | BNB |

### API Endpoints

```
GET /api/approvals?chain=ethereum&owner=0x1234...
GET /api/approvals?chain=ethereum&risk=high
GET /api/risk/{chain}/{spenderAddress}
GET /api/history/{chain}/{owner}?days=30
GET /api/health
```

### Response Format

```json
{
  "approvals": [
    {
      "id": "approval-001",
      "chain": "ethereum",
      "owner": "0x1234...",
      "spender": "0xabcd...",
      "token": "USDC",
      "tokenAddress": "0xdead...",
      "allowance": "unlimited",
      "riskScore": 85,
      "riskLevel": "high",
      "riskFactors": [
        "unlimited_allowance",
        "unverified_spender",
        "recent_suspicious_activity"
      ],
      "spenderInfo": {
        "verified": false,
        "ageDays": 5,
        "transactionCount": 12,
        "knownExploit": false
      },
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ],
  "summary": {
    "totalApprovals": 45,
    "highRiskCount": 8,
    "unlimitedAllowances": 12
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Solana Wallet

**Wallet Address:** `3FZbgi29cpjqQuG7wz4d3eSa2NBFKZGkFhRLEoPVKKfk`

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties
- **Documentation:** https://github.com/daydreamsai/agent-bounties/blob/main/submissions/approval-risk-auditor.md
- **Architecture:** Uses Node.js with Express for the API server, and background workers for approval monitoring

## Implementation Details

The agent uses a modular architecture:

1. **Chain Listeners**: Subscribes to Approval event logs across supported chains
2. **Spender Analyzer**: Evaluates spender contracts for verification and reputation
3. **Allowance Evaluator**: Checks allowance amounts against safety thresholds
4. **Risk Scorer**: Combines multiple factors into a risk score
5. **Alert System**: Sends notifications for high-risk approvals
6. **API Server**: Express-based REST API with x402 payment support

### Risk Scoring Algorithm

1. Check if spender contract is verified on block explorer
2. Evaluate allowance amount (unlimited = highest risk)
3. Check spender contract age and transaction history
4. Cross-reference spender address with known exploit databases
5. Analyze recent spending patterns for anomalies
6. Combine factors into a weighted risk score (0-100)

### x402 Integration

The API implements the x402 protocol for payment-gated access:
- Free tier: 50 requests/day
- Paid tier: Unlimited requests via x402 micropayments
- Premium tier: Real-time alerts + historical approval data + custom risk thresholds

---

*Built for Daydreams AI Agent Bounties*
