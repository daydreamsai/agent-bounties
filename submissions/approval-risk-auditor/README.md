# Approval Risk Auditor

**Bounty:** [Daydreams Agent Bounties #5](https://github.com/daydreamsai/agent-bounties/issues/5)

## Purpose

Flags unlimited or stale ERC-20/NFT approvals and builds ready-to-sign revocation transaction data. Uses Etherscan event log APIs (free, no key required for basic queries) across 7 EVM chains.

## Features

- **ERC-20 approvals**: detects unlimited allowances (≥ MAX_UINT256 / 1000)
- **ERC-721 ApprovalForAll**: detects NFT collection approvals
- **Risk classification**: safe / low / medium / high / critical
- **Risk flags**: UNLIMITED_ALLOWANCE, STALE_>1_YEAR, RISKY_SPENDER, NFT_APPROVAL_FOR_ALL
- **40+ known protocols**: 1inch, Uniswap, 0x, OpenSea, Balancer, SushiSwap, Permit2
- **Risky spenders**: flagged deprecated contracts (OpenSea Wyvern v1/v2)
- **Revoke tx data**: ready-to-sign transaction data for each approval (`approve(spender, 0)` or `setApprovalForAll(operator, false)`)
- **7 chains**: Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche

## Actions

| Action | Description |
|--------|-------------|
| `audit_approvals` | Full wallet scan — all ERC-20 and NFT approvals with risk flags |
| `check_approval` | Check specific token/spender allowance on-chain |
| `echo` | Health check |

## Usage

```bash
npm install
npm start
```

Server starts on port **8092** by default.

### Example — Audit Wallet

```bash
curl -X POST http://localhost:8092/invoke/audit_approvals \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "wallet": "0xYourWalletAddress",
      "chains": ["ethereum", "polygon"],
      "min_risk_level": "medium"
    }
  }'
```

### Example — Check Specific Approval

```bash
curl -X POST http://localhost:8092/invoke/check_approval \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "wallet": "0xYourWallet",
      "token": "0xTokenAddress",
      "spender": "0xSpenderAddress",
      "chain": "ethereum"
    }
  }'
```

## Response Format

```json
{
  "summary": {
    "total_found": 12,
    "flagged": 4,
    "critical": 1,
    "high": 1,
    "medium": 2,
    "unlimited_count": 3
  },
  "approvals": [...],
  "revoke_tx_data": [
    {
      "to": "0xTokenAddress",
      "data": "0x095ea7b3...0000",
      "description": "Revoke OpenSea Wyvern v2 (deprecated) approval"
    }
  ]
}
```

## Tech Stack

- TypeScript + Node.js
- Etherscan / Polygonscan / Arbiscan / Basescan APIs (free, no key required for event logs)
- [Lucid Dreams Agent Kit](https://github.com/daydreamsai/lucid-agents)
- Hono HTTP server
