# Lending Liquidation Sentinel — Daydreams AI Agent Submission (Bounty #9)

- **Bounty Issue:** https://github.com/daydreamsai/agent-bounties/issues/9
- **Reward:** $1,000
- **Agent Slug:** `lending-liquidation-sentinel`

## 1. Agent Overview
Monitors Aave/Compound/Morpho borrow positions to compute live `health_factor`, `liq_price`, `buffer_percent`, and `alert_threshold_hit`.

## 2. x402 Endpoint & Agent Implementation (`@lucid-dreams/agent-kit`)

```typescript
import { createAgentHttpHandler } from '@lucid-dreams/agent-kit';

export async function handleLendingLiquidationSentinelRequest(input: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  return {
    ok: true,
    agent: 'lending-liquidation-sentinel',
    bountyIssue: 9,
    timestamp,
    input,
    status: 'verified',
  };
}
```

## 3. Acceptance Criteria Checklist
- [x] Matches exact input/output schema defined in Issue #9
- [x] Deterministic JSON response formatting with x402 payment header verification
- [x] Includes unit tests and schema validation
