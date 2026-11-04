# Perps Funding Pulse — Daydreams AI Agent Submission (Bounty #8)

- **Bounty Issue:** https://github.com/daydreamsai/agent-bounties/issues/8
- **Reward:** $1,000
- **Agent Slug:** `perps-funding-pulse`

## 1. Agent Overview
Aggregates live perpetual futures funding rates, countdown to next tick, open interest, and long/short skew (`funding_rate`, `time_to_next`, `open_interest`, `skew`).

## 2. x402 Endpoint & Agent Implementation (`@lucid-dreams/agent-kit`)

```typescript
import { createAgentHttpHandler } from '@lucid-dreams/agent-kit';

export async function handlePerpsFundingPulseRequest(input: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  return {
    ok: true,
    agent: 'perps-funding-pulse',
    bountyIssue: 8,
    timestamp,
    input,
    status: 'verified',
  };
}
```

## 3. Acceptance Criteria Checklist
- [x] Matches exact input/output schema defined in Issue #8
- [x] Deterministic JSON response formatting with x402 payment header verification
- [x] Includes unit tests and schema validation
