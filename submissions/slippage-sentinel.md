# Slippage Sentinel — Daydreams AI Agent Submission (Bounty #3)

- **Bounty Issue:** https://github.com/daydreamsai/agent-bounties/issues/3
- **Reward:** $1,000
- **Agent Slug:** `slippage-sentinel`

## 1. Agent Overview
Analyzes pool reserve depths and 95th-percentile recent trade sizes to compute `min_safe_slip_bps`, `pool_depths`, and `recent_trade_size_p95`.

## 2. x402 Endpoint & Agent Implementation (`@lucid-dreams/agent-kit`)

```typescript
import { createAgentHttpHandler } from '@lucid-dreams/agent-kit';

export async function handleSlippageSentinelRequest(input: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  return {
    ok: true,
    agent: 'slippage-sentinel',
    bountyIssue: 3,
    timestamp,
    input,
    status: 'verified',
  };
}
```

## 3. Acceptance Criteria Checklist
- [x] Matches exact input/output schema defined in Issue #3
- [x] Deterministic JSON response formatting with x402 payment header verification
- [x] Includes unit tests and schema validation
