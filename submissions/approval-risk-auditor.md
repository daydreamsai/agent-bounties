# Approval Risk Auditor

## Agent Description

The Approval Risk Auditor is an AI agent that audits a wallet's ERC-20 token approvals across multiple EVM chains. It scans the wallet's transaction history for `approve()` calls, checks current on-chain allowances via RPC, identifies unlimited and stale approvals, and generates valid revocation transaction data.

### Key Features

- **Multi-chain support**: Scans approvals across Ethereum, Base, Polygon, Arbitrum, and Optimism
- **Transaction history scanning**: Parses `approve(address spender, uint256 amount)` calls from Blockscout API
- **On-chain verification**: Checks current allowances via `eth_call` to `allowance()` function
- **Risk assessment**: Classifies approvals as low/medium/high/critical based on:
  - Unlimited approvals (max uint256)
  - Stale approvals (>90 days old)
  - Known high-risk spenders (DEX routers, aggregators)
  - Large allowance values
- **Revocation data**: Generates valid `approve(spender, 0)` transaction data for revoking risky approvals
- **No API keys required**: Uses free Blockscout API and public RPC endpoints

## Live Deployment

**URL:** https://approval-auditor.vercel.app

### Endpoints

- `GET /health` — Health check (no payment required)
- `POST /entrypoints/audit/invoke` — Audit wallet approvals (x402 payment required)

### Usage

```bash
# Health check (free)
curl https://approval-auditor.vercel.app/health

# Audit a wallet (requires x402 payment)
curl -X POST https://approval-auditor.vercel.app/entrypoints/audit/invoke \
  -H "Content-Type: application/json" \
  -d '{"input":{"wallet":"0x9e67f627a17eded3fb7c71417dfe4aa7bfb4cab7","chains":["ethereum"]}}'
```

### Example Response

```json
{
  "output": {
    "wallet": "0x9e67f627...",
    "chains_scanned": ["ethereum"],
    "approvals": [
      {
        "token": "0xdAC17F95...",
        "token_name": "Tether USD",
        "token_symbol": "USDT",
        "spender": "0x6131b5fa...",
        "spender_name": "Kyber Router",
        "allowance": "Unlimited",
        "allowance_raw": "0xffffffff...",
        "is_unlimited": true,
        "is_stale": false,
        "risk_level": "high",
        "risk_flags": ["unlimited_approval", "high_risk_spender", "category:DEX Router"]
      }
    ],
    "revoke_tx_data": [
      {
        "token": "0xdAC17F95...",
        "spender": "0x6131b5fa...",
        "to": "0xdAC17F95...",
        "data": "0x095ea7b30000000000000000000000006131b5fae19ea4f9d964eac0408e4408b66337b50000000000000000000000000000000000000000000000000000000000000000",
        "chain_id": 1,
        "chain_name": "ethereum",
        "description": "Revoke Kyber Router approval on ethereum"
      }
    ],
    "summary": {
      "total_approvals": 4,
      "unlimited_approvals": 3,
      "stale_approvals": 0,
      "high_risk_count": 3
    }
  }
}
```

## Related Bounty Issue

[Bounty #5: Approval Risk Auditor](https://github.com/daydreamsai/agent-bounties/issues/5)

## Acceptance Criteria Checklist

- ✅ **Matches Etherscan approval data for top tokens**: The agent scans transaction history via Blockscout API and verifies current allowances via on-chain `eth_call` to `allowance()`, matching the real approval state on-chain.
- ✅ **Identifies unlimited and stale approvals**: The agent checks if `allowance == MAX_UINT256` for unlimited approvals and compares the approval timestamp against a 90-day threshold for staleness.
- ✅ **Provides valid revocation transaction data**: Generates `approve(spender, 0)` calldata with the correct ERC-20 function selector (`0x095ea7b3`) and properly ABI-encoded parameters.
- ✅ **Deployed on a domain and reachable via x402**: Live at `https://approval-auditor.vercel.app` with x402 payment middleware active (returns 402 with payment requirements when no `X-PAYMENT` header is provided).

## Solana Wallet Address

`CN6eBqPbeyPu2pbMjBRPv5qv1xfsJ63KNDtq2x9ZU8JH`

## Additional Resources

- **Source code**: https://github.com/guyguhiohiuhiu/approval-risk-auditor
- **Agent SDK**: @lucid-dreams/agent-kit v0.2.24
- **Payment protocol**: x402 (Solana USDC)
- **Data sources**: Blockscout API (transaction history) + public RPC (on-chain allowance checks)
