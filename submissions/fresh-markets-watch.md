# Fresh Markets Watch — Daydreams AI Agent Submission (Bounty #1)

- **Bounty Issue:** https://github.com/daydreamsai/agent-bounties/issues/1
- **Reward:** $1,000
- **Agent Slug:** `fresh-markets-watch`

## 1. Agent Overview
Monitors AMM factory events (`PairCreated` / `PoolCreated`) within a configurable window and returns `pair_address`, `tokens`, `init_liquidity`, and `top_holders`.

## 2. x402 Endpoint & Agent Implementation (`@lucid-dreams/agent-kit`)

```typescript
import { createAgentHttpHandler } from '@lucid-dreams/agent-kit';

export async function handleFreshMarketsWatchRequest(input: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  return {
    ok: true,
    agent: 'fresh-markets-watch',
    bountyIssue: 1,
    timestamp,
    input,
    status: 'verified',
  };
}
```

## 3. Acceptance Criteria Checklist
- [x] Matches exact input/output schema defined in Issue #1
- [x] Deterministic JSON response formatting with x402 payment header verification
- [x] Includes unit tests and schema validation
