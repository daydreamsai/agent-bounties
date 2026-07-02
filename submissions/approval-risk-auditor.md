# Approval Risk Auditor

**Bounty:** Issue #5 — Approval Risk Auditor ($1,000)

Detect risky ERC-20 token approvals across multiple EVM chains and output safe revocation transaction data.

## Features

- Scans **ethereum**, **base**, **polygon**, **arbitrum** for active token allowances
- Detects **unlimited approvals** (`type(uint256).max`)
- Detects **stale approvals** (>180 days since last approval event)
- Flags **high-value approvals** (allowance > $10,000 equivalent)
- Generates **revocation transaction data** (`approve(spender, 0)`) for each risk flagged
- Uses `eth_getLogs` with `Approval(address,address,uint256)` event topic filtering
- Built with `@lucid-dreams/agent-kit`, `viem`, and `zod`

## Input Schema

```json
{
  "wallet": "0x...",          // Wallet address to audit
  "chains": ["ethereum"]      // Chains: ethereum, base, polygon, arbitrum
}
```

## Output Schema

```json
{
  "approvals": [
    {
      "token": "0x...",
      "spender": "0x...",
      "amount": "1000000",
      "is_unlimited": false,
      "created_at": 1700000000,
      "days_since_approval": 45
    }
  ],
  "risk_flags": {
    "unlimited_approvals": 1,
    "stale_approvals": 0,
    "high_value_approvals": 2
  },
  "revoke_tx_data": [
    {
      "token": "0x...",
      "spender": "0x...",
      "chain": "ethereum",
      "tx_data": "0x095ea7b300000000..."
    }
  ]
}
```

## Deployment

Deployed and reachable via x402 at the endpoint below:

```
POST /entrypoints/audit-approvals/invoke
```

## Wallet

Solana wallet for bounty payout: *(provided on submission)*

## Links

- [Bounty Issue #5](https://github.com/daydreamsai/agent-bounties/issues/5)
- [Source Code](./approval-risk-auditor/)
