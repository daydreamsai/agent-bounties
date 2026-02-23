# Approval Risk Auditor

## Overview

Flags unlimited or stale ERC-20 token approvals and generates ready-to-sign revocation transactions. Supports Base, Ethereum, Arbitrum, and Optimism.

## How It Works

1. **Token Scanning** — For each chain, scans well-known tokens (WETH, USDC, DAI, cbBTC, weETH, wstETH, etc.) for the target wallet
2. **Approval Event Mining** — Queries `Approval(owner, spender, value)` event logs for the wallet address across the last 100,000 blocks
3. **Current Allowance Check** — For each unique (token, spender) pair from events, reads the current on-chain `allowance()` to confirm it's still active
4. **Risk Classification** — Categorizes each approval:
   - **Critical**: Unlimited approval to unknown contract
   - **High**: Very large allowance (>10^30) to unknown contract
   - **Medium**: Unlimited approval to known/trusted contract (Uniswap, Aave, Aerodrome)
   - **Low**: Reasonable allowance to known contract
5. **Revoke TX Generation** — For high/critical approvals, encodes `approve(spender, 0)` calldata ready for signing

## Entrypoints

### `audit`
Audit wallet token approvals for risks.

**Input:**
- `wallet` — Wallet address to audit
- `chains` — Array of chains to scan (e.g. `["base"]`)

**Output:**
- `wallet` — Audited wallet address
- `total_approvals` — Number of active approvals found
- `critical_count` — Number of critical-risk approvals
- `high_count` — Number of high-risk approvals
- `approvals[]` — Detailed list of each approval with token, spender, allowance, risk level
- `revoke_tx_data[]` — Ready-to-sign transactions to revoke risky approvals

### `health`
Returns `{ status: "ok", timestamp }`.

## Known Spender Registry

The agent recognizes these trusted contracts and adjusts risk scoring accordingly:

- Uniswap V3 Router (Base/Ethereum)
- Aerodrome Router (Base)
- Aave V3 Pool (Base)
- Uniswap Universal Router (Ethereum)

## Tech Stack

- **Runtime:** Node.js / Bun with TypeScript
- **On-chain:** viem for multi-chain RPC calls (event logs, allowance reads, calldata encoding)
- **Framework:** @lucid-dreams/agent-kit with x402 payment middleware

## Deployment

```bash
cd submissions/approval-auditor
npm install
ADDRESS=0xYourWallet NETWORK=base-sepolia tsx src/index.ts
```
