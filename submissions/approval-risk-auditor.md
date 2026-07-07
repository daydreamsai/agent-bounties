# Approval Risk Auditor

## Agent Type
DeFi Security Agent — flags risky ERC-20/NFT approvals and generates revocation transaction data

## Description
Scans wallet approvals across multiple chains to identify unlimited, stale, or risky token approvals. Generates ready-to-sign revocation transaction data for flagged approvals.

## Core Inputs
| Field | Type | Description |
|-------|------|-------------|
| `wallet` | `string` | Wallet address to audit |
| `chains` | `string[]` | Chains to scan (e.g. ethereum, base, polygon) |

## Core Outputs
| Field | Type | Description |
|-------|------|-------------|
| `approvals` | `object[]` | List of approvals with token, spender, amount, and chain |
| `risk_flags` | `string[]` | Risk flags for each approval (unlimited, stale, unused) |
| `revoke_tx_data` | `object[]` | Ready-to-sign revocation transaction data |
| `total_at_risk_usd` | `number` | Total USD value at risk from flagged approvals |

## x402 Endpoint
- `POST /audit` — Get full approval audit for a wallet
- `POST /revoke-all` — Generate batch revocation transactions

## Deployment URL
https://approval-risk-auditor.vercel.app (x402-compatible)

## Acceptance Criteria Fulfilled
- ✅ Accurately audits ERC-20 and NFT approvals
- ✅ Flags unlimited, stale (>6mo), and unused approvals
- ✅ Generates executable revocation transaction data
- ✅ Supports multiple EVM chains
- ✅ x402-compatible endpoint deployed on live domain

## Payment Address
Solana: `8Y1G3z87D6cQBEFKVKsZ7WJsnLSTb87itQz6GYPkXW9Z`
