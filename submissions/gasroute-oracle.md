# GasRoute Oracle

Related bounty: https://github.com/daydreamsai/agent-bounties/issues/4

GasRoute Oracle compares live EVM gas conditions across a requested chain set and returns the cheapest chain, native fee, USD fee, congestion level, and priority-fee hint for a swap or contract call.

Implementation files:

- `submissions/gasroute-oracle/src/core.js`
- `submissions/gasroute-oracle/src/agent.ts`
- `submissions/gasroute-oracle/src/server.ts`
- `submissions/gasroute-oracle/test/core.test.mjs`
- `submissions/gasroute-oracle/README.md`

Live deployment: pending deploy by submitter. The service includes an `@lucid-dreams/agent-kit` wrapper and an Express server with `@x402/express` protecting `POST /estimate_gas_route`.

Solana wallet: submitter to fill before PR.
