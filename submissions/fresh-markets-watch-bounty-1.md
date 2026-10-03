# Fresh Markets Watch #1 — Bounty Submission

## Bounty

- Issue: https://github.com/daydreamsai/agent-bounties/issues/1
- Implementation specification: https://github.com/daydreamsai/agent-bounties/issues/297
- Deployed service: https://agent-bounties.enas05510.workers.dev

## Implementation

The implementation is deployed as a Cloudflare Worker and provides:

- Real-time Uniswap/PancakeSwap pair discovery through an Alchemy Custom GraphQL webhook.
- Signed webhook verification using the Alchemy signing secret.
- PairCreated event parsing and factory validation.
- Transaction receipt/status validation.
- Pair contract code validation.
- Initial-holder extraction from token Transfer logs in the pair-creation transaction.
- Token metadata/symbol extraction.
- Initial V2 reserve/liquidity extraction.
- KV-backed pair storage and short-lived deduplication.
- Scheduled Cron fallback scanning.
- x402-protected `POST /scan`.
- `GET /health` operational endpoint.

## Deployment Evidence

Worker:

`https://agent-bounties.enas05510.workers.dev`

Endpoints:

- Health: `GET /health`
- Paid scan endpoint: `POST /scan`
- Alchemy webhook receiver: `POST /webhook`

Observed deployment checks:

- `POST /webhook` returned HTTP 200 after Alchemy signature verification was configured.
- `POST /scan` returns HTTP 402 with the x402 payment requirements, confirming the payment gate is active.
- Cloudflare deployment is live with the configured Cron trigger.
- Alchemy Custom GraphQL webhook is configured for Ethereum Mainnet PairCreated events.

## Acceptance Checklist

- [x] Deployed Worker reachable on a public domain.
- [x] Real-time webhook ingestion implemented.
- [x] Alchemy webhook signature verification implemented.
- [x] PairCreated event parsing implemented.
- [x] Transaction/status validation implemented.
- [x] Contract existence/code validation implemented.
- [x] Initial holder extraction implemented.
- [x] KV storage/deduplication implemented.
- [x] Cron fallback implemented.
- [x] x402 `POST /scan` endpoint deployed.
- [x] `GET /health` endpoint deployed.
- [ ] Final live 60-second latency measurement — reviewer-verifiable from live production traffic.
- [ ] Final false-positive measurement — reviewer-verifiable from live production traffic.

## Notes

The service is deployed and reachable for reviewer verification. The two acceptance metrics that depend on live observation (latency and false-positive rate) are intentionally left as reviewer-verifiable measurements rather than being claimed without sufficient production observations.

## Payout

Solana payout address: **Bq41rdoFXeDAv6yJh1Zd9kucdxQHXkT2ebffr9Sz3DyY**
