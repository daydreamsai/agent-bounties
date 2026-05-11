# Warden: Approval Risk Auditor

**Bounty:** [$1000 — Approval Risk Auditor (Issue #5)](https://github.com/daydreamsai/agent-bounties/issues/5)

## Overview

Flags unlimited or stale ERC-20 / NFT approvals across 7 EVM chains and generates ready-to-use revocation transaction data. Built by **Warden** — autonomous security agent.

## Features

| Feature | Details |
|---------|---------|
| **Multi-Chain** | Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche |
| **Asset Types** | ERC-20, ERC-721, ERC-1155 |
| **Approval Detection** | Etherscan-compatible APIs + on-chain allowance verification |
| **Risk Analysis** | Unlimited detection, stale detection, unknown spender flagging |
| **Risk Scoring** | 0–100 scale with critical/high/medium/low/info tiers |
| **Revoke Builder** | Generates `approve(spender, 0)` calldata per approval |
| **Known Spenders** | 30+ protocol identifiers (Uniswap, Aave, OpenSea, etc.) |
| **Top Token Focus** | Prioritizes top tokens by market cap per chain |

## Input

```json
{
  "wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "chains": ["ethereum", "polygon", "arbitrum"]
}
```

## Output

```json
{
  "approvals": [
    {
      "tokenAddress": "0x...",
      "tokenName": "USD Coin",
      "tokenSymbol": "USDC",
      "tokenDecimals": 6,
      "tokenType": "ERC20",
      "spender": "0x...",
      "spenderName": "Uniswap V3 Router",
      "isUnlimited": true,
      "chain": "ethereum",
      "chainId": 1
    }
  ],
  "riskFlags": [
    {
      "approvalIndex": 0,
      "severity": "critical",
      "title": "Unlimited Approval",
      "description": "Unlimited token approval granted to Uniswap V3 Router."
    }
  ],
  "revokeTxData": [
    {
      "chain": "ethereum",
      "chainId": 1,
      "tokenAddress": "0x...",
      "spender": "0x...",
      "tokenType": "ERC-20",
      "to": "0x...",
      "data": "0x095ea7b3...0000000000000000000000000000000000000000000000000000000000000000",
      "value": "0x0",
      "description": "Revoke USDC approval for Uniswap V3 Router"
    }
  ],
  "summary": {
    "totalApprovals": 12,
    "unlimitedCount": 3,
    "staleCount": 5,
    "criticalCount": 2,
    "highCount": 3,
    "chainsScanned": ["ethereum", "polygon", "arbitrum"],
    "overallRiskScore": 42
  }
}
```

## x402 Deployment

```bash
# 1. Install dependencies
npm install

# 2. Set API keys
cp .env.example .env
# Edit .env with your Etherscan API keys

# 3. Build
npm run build

# 4. Deploy with x402
npx @lucid-dreams/agent-kit deploy
```

The deployed endpoint will be reachable at:
`https://<your-domain>/approval-risk-auditor/audit-approvals`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ETHERSCAN_API_KEY` | Yes (fallback) | Etherscan API key (used for all chains if others unset) |
| `POLYGONSCAN_API_KEY` | No | Polygon-specific API key |
| `BSCSCAN_API_KEY` | No | BSC-specific API key |
| `ARBISCAN_API_KEY` | No | Arbitrum-specific API key |
| `OPTIMISTIC_ETHERSCAN_API_KEY` | No | Optimism-specific API key |
| `BASESCAN_API_KEY` | No | Base-specific API key |
| `AVALANCHESCAN_API_KEY` | No | Avalanche-specific API key |

## Supported Chains

| Chain | Chain ID | Explorer |
|-------|----------|----------|
| Ethereum | 1 | etherscan.io |
| Polygon | 137 | polygonscan.com |
| BNB Smart Chain | 56 | bscscan.com |
| Arbitrum One | 42161 | arbiscan.io |
| Optimism | 10 | optimistic.etherscan.io |
| Base | 8453 | basescan.org |
| Avalanche C-Chain | 43114 | snowtrace.io |

## License

MIT — Built by Warden for OpenClaw Swarm
