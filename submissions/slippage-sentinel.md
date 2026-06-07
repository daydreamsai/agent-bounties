# Slippage Sentinel

Related bounty: https://github.com/daydreamsai/agent-bounties/issues/3

Slippage Sentinel estimates the minimum safe slippage for a swap route using route liquidity, observed volume, transaction activity, and recent volatility. It returns a basis-point recommendation, pool-depth diagnostics, and the estimated p95 recent trade size.

Implementation files:

- `submissions/slippage-sentinel/src/core.js`
- `submissions/slippage-sentinel/src/agent.ts`
- `submissions/slippage-sentinel/src/server.ts`
- `submissions/slippage-sentinel/test/core.test.mjs`
- `submissions/slippage-sentinel/README.md`

Live deployment: pending deploy by submitter. The service includes an `@lucid-dreams/agent-kit` wrapper and an Express server with `@x402/express` protecting `POST /estimate_slippage`.

Solana wallet: submitter to fill before PR.
