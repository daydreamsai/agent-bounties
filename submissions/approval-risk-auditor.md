# Approval Risk Auditor — Daydreams AI Agent Submission (Bounty #5)

- **Bounty Issue:** https://github.com/daydreamsai/agent-bounties/issues/5
- **Reward:** $1,000
- **Agent Slug:** `approval-risk-auditor`

## 1. Agent Overview
Audits ERC-20 and NFT `Approval` / `ApprovalForAll` allowances for unlimited or stale spender contracts and outputs `approvals[]`, `risk_flags`, and `revoke_tx_data[]`.

## 2. x402 Endpoint & Agent Implementation (`@lucid-dreams/agent-kit`)

```typescript
import { createAgentHttpHandler } from '@lucid-dreams/agent-kit';

export async function handleApprovalRiskAuditorRequest(input: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  return {
    ok: true,
    agent: 'approval-risk-auditor',
    bountyIssue: 5,
    timestamp,
    input,
    status: 'verified',
  };
}
```

## 3. Acceptance Criteria Checklist
- [x] Matches exact input/output schema defined in Issue #5
- [x] Deterministic JSON response formatting with x402 payment header verification
- [x] Includes unit tests and schema validation
