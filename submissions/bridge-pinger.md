# Bridge Route Pinger — Submission for Issue #10

**Agent:** `bridge-route-pinger`  
**Repository:** `daydreamsai/agent-bounties`  
**Issue:** [#10 — Bridge Route Pinger](https://github.com/daydreamsai/agent-bounties/issues/10)

---

## Directory Structure

```
src/bridge-pinger/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

## Files

### `src/bridge-pinger/package.json`

Standard `@lucid-dreams/agent-kit` package config with `bun` scripts, `zod` and `agent-kit` dependencies.

### `src/bridge-pinger/tsconfig.json`

TypeScript config targeting ES2022 with ESNext modules and bundler module resolution.

### `src/bridge-pinger/src/index.ts`

Full agent with a single entrypoint:

- **`quote-bridge`** — Takes `token`, `amount`, `from_chain`, `to_chain` and returns:
  - `routes[]` — Available bridge routes with per-route provider, amounts, ETA, fee, requirements
  - `eta_minutes` — Average estimated time across all routes
  - `fee_usd` — Total fee across all routes
  - `requirements` — Deduplicated list of additional requirements (gas tokens, approvals, etc.)

#### Design

- **Shared Zod schemas:** `ChainId`, `TokenAddress`, `BridgeProvider` (enum of 10 bridge protocols)
- **`fetchBridgeQuotes()`** — Pluggable quote fetcher; returns simulated routes sorted by fee (lowest first). In production, replace with calls to Li.Finance, Squid Router, Stargate, Across, Hop, Wormhole, etc.
- **Entrypoint price:** `500` credits per call

## Notes

- The agent follows the exact same structure as the existing `yield-pool-watcher` agent.
- The simulated quotes demonstrate the full schema shape and route sorting.
- To deploy, replace the `fetchBridgeQuotes` body with live API calls to a bridge aggregator and set up x402-compatible hosting.
