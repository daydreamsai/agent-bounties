# Fresh Markets Watch

## Related Bounty

Issue: https://github.com/daydreamsai/agent-bounties/issues/1

## Description

Fresh Markets Watch lists newly created AMM V2 pairs from live factory
`PairCreated` logs. It supports Ethereum and Base, scans allowlisted or explicit
factory addresses, timestamp-filters results by block time, and enriches fresh
pairs with initial reserve data and LP mint evidence.

The agent uses `@lucid-dreams/agent-kit` with x402 payments.

## Live Deployment

- Agent: https://fresh-markets-watch.doug-lance.workers.dev
- Manifest: https://fresh-markets-watch.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `POST /entrypoints/watch-fresh-markets/invoke`

## Source

- Repository: https://github.com/douglance/fresh-markets-watch
- Specification: https://github.com/douglance/fresh-markets-watch/blob/main/SPEC.md
- Deployment notes: https://github.com/douglance/fresh-markets-watch/blob/main/DEPLOY.md

## Supported Inputs

```json
{
  "chain": "ethereum",
  "factories": ["uniswap_v2", "sushiswap_v2"],
  "window_minutes": 60,
  "max_pairs": 10
}
```

## Returns

- `pairs`: fresh market list with pair address, token addresses, factory, block,
  transaction hash, creation timestamp, initial reserves, and top LP minters
- `pair_address`, `tokens`, `init_liquidity`, `top_holders`, `created_at`:
  convenience fields for the freshest result
- `data_sources`: JSON-RPC methods, chain id, scanned block range, and cutoff
- `false_positive_controls`: event and timestamp filtering controls
- `confidence`: based on recent result coverage

## Validation

Local validation:

```text
npm run build
npm test
npm run smoke:live
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
git diff --check
```

Observed live checks:

```text
curl -fsS https://fresh-markets-watch.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://fresh-markets-watch.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes watch-fresh-markets and x402/AP2 metadata

unpaid POST /entrypoints/watch-fresh-markets/invoke
-> HTTP 402 with x402 payment requirements for base-sepolia
```

Direct live Ethereum smoke against Uniswap V2 and SushiSwap found 2 fresh pairs
over blocks 25022396 through 25072996, returned first pair
`0x503d75d9692462b837a3a2dc50e3b6db5cdf19d3`, and confidence 0.76.

## Solana Wallet

`EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
