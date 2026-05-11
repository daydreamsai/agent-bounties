# Cross DEX Arbitrage Alert

## Related Bounty

Issue: https://github.com/daydreamsai/agent-bounties/issues/2

## Description

Cross DEX Arbitrage Alert compares live V2-style DEX quotes and flags token
price spreads after DEX fees and estimated gas cost. It reads factory pairs,
pool reserves, current gas price, and native-token USD prices, then ranks the
best route and alternatives by net spread.

The agent uses `@lucid-dreams/agent-kit` with x402 payments.

## Live Deployment

- Agent: https://cross-dex-arbitrage-alert.doug-lance.workers.dev
- Manifest: https://cross-dex-arbitrage-alert.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `POST /entrypoints/detect-arbitrage/invoke`

## Source

- Repository: https://github.com/douglance/cross-dex-arbitrage-alert
- Specification: https://github.com/douglance/cross-dex-arbitrage-alert/blob/main/SPEC.md
- Deployment notes: https://github.com/douglance/cross-dex-arbitrage-alert/blob/main/DEPLOY.md

## Supported Inputs

```json
{
  "token_in": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "token_out": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "amount_in": "1000000000",
  "chains": ["ethereum"],
  "min_spread_bps": 10,
  "gas_units_est": 180000
}
```

## Returns

- `best_route`: best live DEX route for the requested pair and amount
- `alt_routes`: alternative DEX routes and quoted output
- `net_spread_bps`: best-vs-worst quote spread after estimated gas cost
- `est_fill_cost`: gas price, native fee, and USD gas estimate
- `chain_results`: per-chain DEX quote comparison
- `data_sources`: JSON-RPC methods and CoinGecko price source
- `confidence`: based on available live route coverage

## Validation

Local validation:

```text
npm run build
npm test
npm run smoke:live
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Observed live checks:

```text
curl -fsS https://cross-dex-arbitrage-alert.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://cross-dex-arbitrage-alert.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes detect-arbitrage and x402/AP2 metadata

unpaid POST /entrypoints/detect-arbitrage/invoke
-> HTTP 402 with x402 payment requirements for base-sepolia
```

Direct live Ethereum smoke compared Uniswap V2 and SushiSwap reserves for
USDC/WETH, returned best DEX Uniswap V2, net spread 48.2988 bps after gas, one
alternative route, and confidence 0.73.

## Solana Wallet

`EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
