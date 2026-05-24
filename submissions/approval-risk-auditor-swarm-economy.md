# Approval Risk Auditor — Swarm Economy

## Agent Description

**Approval Risk Auditor** scans ERC-20 approvals via on-chain `Approval` logs and live `allowance()` reads, flags unlimited/stale/high-risk allowances, and returns revoke calldata.

- **Entrypoint:** `POST /entrypoints/audit/invoke`
- **Inputs:** `wallet`, `chains`
- **Outputs:** `approvals[]`, `risk_flags`, `revoke_tx_data[]`

## Live Deployment

- **Health:** `http://127.0.0.1:8095/health`
- **x402:** paywall on `/entrypoints/audit/invoke`
- **Production path:** `https://api.agentic-swarm-marketplace.com/agents/approval-risk-auditor/health`

## Source Code

https://github.com/Hobie1Kenobi/agentic-crypto-swarm-prototype/tree/master/packages/daydreams-agents/approval-risk-auditor

## Related Bounty

Closes #5

## Solana Wallet (payout)

`Bq1sMShfZw3oNVoNMjX78zSPcoaCan9r1NVKXctpG3nN`

## Acceptance Criteria

- [x] On-chain approval discovery via event logs + allowance reads
- [x] Flags unlimited and stale approvals
- [x] Revoke tx calldata (`approve(spender, 0)`)
- [x] x402 paywall on invoke endpoint
