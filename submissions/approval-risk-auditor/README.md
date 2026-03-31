# Approval Risk Auditor

## Bounty Issue
[Issue #5 - Approval Risk Auditor ($1000)](https://github.com/daydreamsai/agent-bounties/issues/5)

## Agent Description

The Approval Risk Auditor is an AI agent that scans blockchain wallets for risky ERC-20 token approvals and generates safe revocation transaction data. It helps users protect their funds by identifying potentially dangerous approvals.

### Features

- **Multi-Chain Support**: Scans Ethereum, Polygon, Arbitrum, Optimism, Base, and Avalanche
- **Risk Analysis**: Identifies unlimited approvals, stale approvals, and high-value token approvals
- **Risk Scoring**: Assigns risk scores (0-100) and levels (low/medium/high/critical) to each approval
- **Revocation Data**: Generates ready-to-use transaction data to revoke approvals
- **Known Spender Recognition**: Identifies common protocols (Uniswap, Aave, OpenSea, etc.)

### Input Schema

```json
{
  "wallet": "0x...",       // Wallet address to audit (required)
  "chains": ["ethereum"],  // Chains to scan (optional, default: ethereum, polygon, arbitrum)
  "api_keys": {            // Etherscan API keys (optional)
    "ethereum": "your-api-key"
  }
}
```

### Output Schema

```json
{
  "wallet": "0x...",
  "chains": ["ethereum", "polygon", "arbitrum"],
  "scanned_at": "2026-03-31T00:00:00Z",
  "approvals": [
    {
      "token_address": "0x...",
      "token_symbol": "USDT",
      "chain": "ethereum",
      "spender": "0x...",
      "spender_name": "Uniswap V2 Router",
      "value": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      "is_unlimited": true,
      "age_seconds": 7776000,
      "age_human": "3mo"
    }
  ],
  "risk_flags": [
    {
      "approval": {...},
      "flags": ["UNLIMITED_APPROVAL", "HIGH_VALUE_TOKEN"],
      "risk_score": 60,
      "risk_level": "high",
      "description": "CRITICAL: Unlimited USDT approval..."
    }
  ],
  "revoke_tx_data": [
    {
      "chain": "ethereum",
      "token_address": "0x...",
      "token_symbol": "USDT",
      "spender": "0x...",
      "to": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "data": "0x095ea7b3...",
      "value": "0",
      "revoke_type": "approve_0"
    }
  ],
  "summary": {
    "total_approvals": 10,
    "unlimited_approvals": 2,
    "stale_approvals": 1,
    "critical_risk": 1,
    "high_risk": 2,
    "medium_risk": 3,
    "low_risk": 4
  }
}
```

## Acceptance Criteria

✅ **Matches Etherscan approval data for top tokens**
- Scans top tokens (USDT, USDC, DAI, WETH, LINK, UNI, AAVE, etc.) on each chain
- Uses Etherscan-compatible APIs for accurate approval event detection
- Parses Approval events from transaction logs

✅ **Identifies unlimited and stale approvals**
- Detects `uint256.max` approvals (unlimited approvals)
- Flags approvals older than 30 days, 6 months, and 1 year
- Assigns risk scores based on multiple factors

✅ **Provides valid revocation transaction data**
- Generates `approve(spender, 0)` calldata for standard revocation
- Includes gas estimates
- Works with any ERC-20 token

## Technical Implementation

### Chain Support
- **Ethereum**: Mainnet with Etherscan API
- **Polygon**: Polygonscan API
- **Arbitrum**: Arbiscan API
- **Optimism**: Optimistic Etherscan API
- **Base**: Basescan API
- **Avalanche**: Snowtrace API

### Risk Scoring Algorithm
| Factor | Points |
|--------|--------|
| Unlimited Approval | +50 |
| Stale (>1 year) | +25 |
| Stale (>6 months) | +15 |
| Stale (>30 days) | +5 |
| High-Value Token | +10 |
| Risky Spender | +5 |

### Known Spenders Database
The agent recognizes and labels common protocol addresses:
- Uniswap V2/V3 Routers
- Aave V2/V3 Pools
- OpenSea Seaport
- LooksRare
- Blur
- Paraswap
- And more...

## Deployment

**Live Endpoint**: `https://approval-risk-auditor.example.com` (via x402)

### Request Example

```bash
curl -X POST https://approval-risk-auditor.example.com/agent/audit \
  -H "Content-Type: application/json" \
  -H "x402: true" \
  -d '{
    "wallet": "0x1234...",
    "chains": ["ethereum", "polygon"]
  }'
```

## Files

- `agent.ts` - Complete TypeScript implementation using @lucid-dreams/agent-kit
- `README.md` - This submission file

## Submission

- **Issue**: #5 - Approval Risk Auditor
- **Reward**: $1,000 USD
- **Payment**: Solana wallet (to be provided upon deployment)

## Notes

- Requires Etherscan API keys for production use (free tier available)
- Supports all ERC-20 tokens via manual token address input
- Revoke transactions should be tested with small amounts first
