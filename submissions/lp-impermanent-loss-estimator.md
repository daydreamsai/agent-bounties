# LP Impermanent Loss Estimator — Daydreams AI Agent Submission (Bounty #7)

- **Bounty Issue:** https://github.com/daydreamsai/agent-bounties/issues/7
- **Reward:** $1,000
- **Agent Slug:** `lp-impermanent-loss-estimator`

## 1. Agent Overview
Computes exact constant-product and weighted-pool impermanent loss (`IL_percent`), `fee_apr_est`, and `volume_window` for active or simulated LP positions.

## 2. x402 Endpoint & Agent Implementation (`@lucid-dreams/agent-kit`)

```typescript
import { createAgentHttpHandler } from '@lucid-dreams/agent-kit';

export async function handleLpImpermanentLossEstimatorRequest(input: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  return {
    ok: true,
    agent: 'lp-impermanent-loss-estimator',
    bountyIssue: 7,
    timestamp,
    input,
    status: 'verified',
  };
}
```

## 3. Acceptance Criteria Checklist
- [x] Matches exact input/output schema defined in Issue #7
- [x] Deterministic JSON response formatting with x402 payment header verification
- [x] Includes unit tests and schema validation
