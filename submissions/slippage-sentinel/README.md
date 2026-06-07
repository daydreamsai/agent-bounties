# Slippage Sentinel

Slippage Sentinel estimates a safe slippage tolerance for a proposed swap route. It pulls candidate pools from Dexscreener, ranks the deepest matching pools, and combines route depth, recent volume, trade activity, volatility, and order size into a basis-point recommendation.

## Entrypoint

`estimate_slippage`

Input:

```json
{
  "token_in": "0x4200000000000000000000000000000000000006",
  "token_out": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "amount_in": "1.0",
  "amount_usd": 3500,
  "route_hint": "base/uniswap"
}
```

Output:

```json
{
  "min_safe_slip_bps": 64,
  "pool_depths": [],
  "recent_trade_size_p95": 9500,
  "confidence": "high"
}
```

## Method

The estimator combines:

- route liquidity depth
- recent 24h volume and transaction count
- volatility from 24h price change
- trade size relative to estimated p95 recent trade size
- a conservative depth penalty for thin routes

The output is clamped to 25-1000 bps to avoid unsafe zero-slippage output and to flag routes that are too thin for the requested size.

## Run

```bash
npm install
npm test
X402_PAY_TO=0xYourAddress npm start
```

## Deployment Notes

Deploy this package as an `@lucid-dreams/agent-kit` app or run the included Express server. The server protects `POST /estimate_slippage` with `@x402/express` and leaves `GET /health` open for uptime checks.

Environment:

- `X402_PAY_TO`: EVM address that receives x402 payments, required
- `X402_NETWORK`: CAIP-2 EVM network, default `eip155:84532` (Base Sepolia)
- `X402_FACILITATOR_URL`: default `https://x402.org/facilitator`
- `X402_PRICE`: default `$0.001`
- `PORT`: default `3000`

For best accuracy in production, add a quote provider such as 0x, 1inch, or your own swap simulator and compare actual revert rates against the returned `min_safe_slip_bps`.
