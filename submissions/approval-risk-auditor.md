# Approval Risk Auditor

## Description

The Approval Risk Auditor is a DeFi security agent that scans Ethereum wallet addresses for risky ERC-20 token approvals across multiple EVM chains. It identifies unlimited allowances, stale approvals, and suspicious contract spenders, then generates valid revocation transaction data.

## Features

- **Multi-chain scanning**: Supports Ethereum, BSC, Polygon, Arbitrum, Optimism, Base, Avalanche, and more
- **Comprehensive detection**:
  - Unlimited (MAX_UINT256) allowances
  - Stale approvals (not used for 6+ months)
  - Suspicious unverified contract spenders
  - Non-zero allowances to unknown addresses
- **Revocation data**: Generates valid `approve(spender, 0)` calldata for each risky approval
- **Built with @lucid-dreams/agent-kit**: Uses the official agent framework with x402 payment support

## Technical Architecture

### Core Components

1. **`src/index.ts`** - Main agent entry point using `createAgentApp` from `@lucid-dreams/agent-kit`
   - Single entrypoint: `audit` - accepts wallet address and chain list
   - Returns approvals, risk flags, and revocation transaction data
   - x402 payment integration (USDC on Base)

2. **`src/auditor.ts`** - On-chain approval scanning engine
   - RPC-based allowance checks using batched JSON-RPC calls
   - Etherscan-compatible API fallback for comprehensive scanning
   - Contract verification for spender addresses
   - Token metadata fetching (symbol, name)

3. **`src/approval-types.ts`** - Type definitions and utilities
   - Known token addresses per chain
   - Known DEX/DeFi spender addresses
   - RPC endpoints for all supported chains
   - Revoke transaction data encoder

### Input/Output

**Input:**
```json
{
  "wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "chains": [1, 56, 137]
}
```

**Output:**
```json
{
  "approvals": [
    {
      "token_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "token_symbol": "USDC",
      "spender": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      "chain_id": 1,
      "amount": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      "is_unlimited": true
    }
  ],
  "risk_flags": [
    {
      "approval_index": 0,
      "flags": [
        {
          "type": "unlimited_allowance",
          "severity": "critical",
          "message": "Unlimited approval granted to 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
        }
      ]
    }
  ],
  "revoke_tx_data": [
    {
      "approval_index": 0,
      "token_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "spender": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      "chain_id": 1,
      "to": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "data": "0x095ea7b3...",
      "value": "0x0",
      "gas_estimate": "46000"
    }
  ],
  "summary": {
    "total_approvals": 1,
    "critical_risks": 1,
    "high_risks": 0,
    "medium_risks": 0,
    "low_risks": 0,
    "chains_scanned": [1, 56, 137]
  }
}
```

## Testing

- **Unit tests**: Approval type utilities, revocation data encoding
- **Mock integration tests**: Auditor with mocked RPC responses
- **Run tests**: `bun test` (10 tests, all passing)

## Deployment

The agent is deployed and accessible via x402 protocol.

**Deployment URL:** https://rpm-wonderful-eyes-ownership.trycloudflare.com

### How to run locally

```bash
bun install
bun run src/index.ts
```

The agent starts an HTTP server (Hono-based) with:
- `GET /health` - Health check
- `GET /.well-known/agent.json` - Agent manifest
- `POST /entrypoints/audit/invoke` - Audit endpoint (x402 payment required)

## Related Bounty Issue

[Approval Risk Auditor - Issue #5](https://github.com/daydreamsai/agent-bounties/issues/5)

## Wallet for Payment

**Solana:** `14XeLRYzRwyzwXGMDCdjoQmnUQHy5HdEfg6XwbpV7opp`

## Code Repository

[597226617/agent-bounties](https://github.com/597226617/agent-bounties) - PR branch contains the full implementation.
