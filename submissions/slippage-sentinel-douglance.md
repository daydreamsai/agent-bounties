# Slippage Sentinel

Related bounty: #3

## Agent

Slippage Sentinel estimates safe AMM slippage for token swap routes using live
pool reserves, route fees, and recent same-direction swap-size data.

## Live Deployment

- Agent URL: https://slippage-sentinel.doug-lance.workers.dev
- Manifest: https://slippage-sentinel.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `suggest-slippage`
- Invoke path: `POST /entrypoints/suggest-slippage/invoke`

The deployment is reachable via x402. Unpaid invokes return HTTP 402 with
base-sepolia USDC payment requirements.

## Source

https://github.com/douglance/slippage-sentinel

## Supported Inputs

```json
{
  "token_in": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "token_out": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "amount_in": "1000",
  "route_hint": "auto",
  "chain": "ethereum",
  "lookback_blocks": 2000
}
```

Supported chains:

- `ethereum`
- `base`

Supported routes:

- `auto`
- `uniswap-v2`
- `sushiswap`

## Output Summary

The agent returns:

- `min_safe_slip_bps`
- `expected_amount_out`
- `price_impact_bps`
- `route_size_bps`
- `route`
- `pool_depths[]`
- `recent_trade_size_p95`
- `notes[]`
- `data_sources`
- `confidence`

## Acceptance Criteria Coverage

- Uses live JSON-RPC data through viem public clients.
- Finds V2 pools through factory `getPair`.
- Reads pair `token0` and `getReserves`.
- Reads ERC-20 `symbol` and `decimals`.
- Scans recent `Swap` logs in chunks and computes same-direction trade-size p95.
- Combines constant-product price impact, route fee, pool-depth ratio, and p95 recent trade size into a bounded safe slippage floor.
- Returns pool-depth data for candidate routes and confidence/notes for thin samples.
- Deployed on a public domain and reachable via x402.

## Validation

Local validation:

```text
npm run build
npm test
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Direct live RPC smoke against Ethereum USDC/WETH:

```json
{
  "min_safe_slip_bps": 55,
  "route": {
    "dex": "uniswap-v2",
    "dex_name": "Uniswap V2",
    "pair": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
    "fee_bps": 30
  },
  "recent_trade_size_p95": "5788.997636",
  "pools": 2,
  "confidence": 0.8
}
```

Live endpoint checks:

```text
curl -fsS https://slippage-sentinel.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://slippage-sentinel.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes suggest-slippage and x402 payments metadata

curl -i -X POST https://slippage-sentinel.doug-lance.workers.dev/entrypoints/suggest-slippage/invoke \
  -H 'content-type: application/json' \
  -d '{"input":{"token_in":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","token_out":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","amount_in":"1000","route_hint":"auto","chain":"ethereum","lookback_blocks":1000}}'
-> HTTP 402 with x402 payment requirements
```

## Payout Wallet

Solana: `EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
