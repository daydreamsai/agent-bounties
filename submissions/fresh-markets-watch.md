# Fresh Markets Watch — Daydreams bounty #1

**Related issue:** https://github.com/daydreamsai/agent-bounties/issues/1  
**Code:** https://github.com/dawang-tools/fresh-markets-watch

## Agent
Scans Base UniswapV2-style factories for `PairCreated` logs in the last N minutes and returns:
`pair_address`, `tokens`, `init_liquidity`, `top_holders`, `created_at`.

## Live link
- Health: https://soft-books-care.loca.lt/health
- Watch (x402 gated): `POST https://soft-books-care.loca.lt/watch`
- Without `X-PAYMENT` returns **HTTP 402** with USDC payment instructions (Base).

## Acceptance progress
- [x] Emits new pairs from live Base RPC (see `evidence/` in code repo)
- [ ] False positive rate validated under 1% (longer run + ground truth in progress)
- [x] Deployed on a public URL (localtunnel; upgrading to stable domain)
- [x] Reachable via x402 payment surface (`402` + `X-PAYMENT` gate)

## Solana wallet (payout)
`3BCVxDxuFpoAvQsDZMJw75PzKsKHjKvGXwioFTTPUM7o`

## Notes
Core scanner is live on Base RPC. Next: stable domain + full x402 facilitator settlement verification + FP<1% evidence.
