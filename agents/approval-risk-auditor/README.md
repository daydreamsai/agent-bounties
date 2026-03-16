# Approval Risk Auditor

Flag unlimited or stale ERC-20 / NFT approvals and build revoke calls.

## Overview

This agent scans a wallet's token approvals across multiple EVM chains and identifies risky approvals. It generates ready-to-use transaction data for revoking dangerous allowances.

## Features

- **Multi-chain support**: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC
- **ERC-20 approval scanning**: Checks allowances against known DEX routers, aggregators, and NFT marketplaces
- **ERC-721 approval scanning**: Detects `setApprovalForAll` grants to marketplace operators
- **Risk assessment**: Classifies approvals as critical, high, medium, or low risk
- **Revocation data**: Generates calldata for revoking each risky approval

## Risk Levels

| Level | Criteria |
|-------|----------|
| **Critical** | Unlimited allowance to unknown spender |
| **High** | Unlimited allowance to any spender, or NFT approved-for-all |
| **Medium** | Very high allowance, or unknown spender |
| **Low** | Reasonable allowance to known spender |

## Entrypoints

### `audit`

Scan a wallet's approvals.

**Input:**
```json
{
  "wallet": "0x...",
  "chains": ["ethereum", "polygon"]  // optional, defaults to ["ethereum"]
}
```

**Output:**
```json
{
  "wallet": "0x...",
  "chains": ["ethereum"],
  "scannedAt": "2024-01-01T00:00:00.000Z",
  "totalApprovals": 5,
  "riskyApprovals": 2,
  "approvals": [...],
  "riskFlags": { "critical": 0, "high": 1, "medium": 1, "low": 3 },
  "revokeTxData": [...]
}
```

### `health-check`

Quick health check.

## Running

```bash
bun install
bun run dev    # development
bun run start  # production
```

## Deployment

Deploy on any platform that supports Bun (Fly.io, Railway, etc.) and ensure it's reachable via x402.

## License

MIT
