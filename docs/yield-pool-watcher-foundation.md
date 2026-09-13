# Yield Pool Watcher Foundation

Implementation for [bounty issue #307](https://github.com/daydreamsai/agent-bounties/issues/307).

The foundation provides:

- typed \`PoolSnapshot\`, \`PoolDelta\`, \`Alert\`, \`AlertCooldown\`, and
  \`ThresholdRules\` interfaces
- EIP-55 checksummed pool IDs
- Cloudflare KV helpers for latest and previous snapshots
- retryable KV operations with two exponential-backoff retries
- x402 v2 \`HTTP 402 Payment Required\` middleware
- a small Cloudflare Worker exposing \`GET /health\` and paid \`POST /metrics\`

## Validation

\`\`\`text
npm run check
11 tests passed
npx wrangler deploy --dry-run
successful
\`\`\`

The tests use an in-memory KV implementation and never send a real payment.

## Deployment

Live Worker:

<https://yield-pool-watcher-foundation.bdinesh1126.workers.dev>

- \`GET /health\` returns \`200\`.
- \`POST /metrics\` without \`PAYMENT-SIGNATURE\` returns \`402\` with a
  base64-encoded \`PAYMENT-REQUIRED\` x402 v2 header.
- \`POST /metrics\` with a payment signature reaches the metrics handler.

The API payment recipient is configured as a Worker secret and is separate
from the Solana wallet used for the bounty reward.

## Acceptance mapping

| Issue #307 requirement | Implementation |
| --- | --- |
| Shared TypeScript interfaces | \`src/types.ts\` |
| Checksummed pool IDs | \`src/address.ts\` |
| \`writeSnapshot\`, \`readSnapshot\`, \`hasSnapshot\`, \`listSnapshots\` | \`src/kv.ts\` |
| Retry logic and TTL support | \`src/kv.ts\` |
| HTTP 402 payment requirements | \`src/x402.ts\` |
| Typed/importable exports | TypeScript strict mode |
| Unit tests | \`src/__tests__/\` |
