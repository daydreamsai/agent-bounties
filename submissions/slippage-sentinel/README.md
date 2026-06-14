# Slippage Sentinel

`slippage-sentinel` estimates a conservative safe slippage tolerance for a swap route using live pool depth, recent trade sizes, and short-window price movement.

It does not request private keys, sign transactions, or broadcast swaps.

## Input

```json
{
  "chain": "base",
  "token_in": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "token_out": "0x4200000000000000000000000000000000000006",
  "amount_in": "1000",
  "route_hint": {
    "pool_address": "0xcdac0d6c6c59727a65f871236188350531885c43"
  }
}
```

Supported chains: `ethereum`, `base`, `polygon`, `arbitrum`, `optimism`, `bsc`, `avalanche`.

## Output

```json
{
  "min_safe_slip_bps": 57,
  "pool_depths": [
    {
      "chain": "base",
      "dex": "aerodrome-base",
      "pool_address": "0xcdac0d6c6c59727a65f871236188350531885c43",
      "reserve_usd": 5859424.5258,
      "estimated_price_impact_bps": 4
    }
  ],
  "recent_trade_size_p95": 26.57,
  "backtest_summary": {
    "scenario_count": 6,
    "covered_count": 6,
    "pass_rate_pct": 100,
    "max_shortfall_bps": 0,
    "simulated_swap_count": 100,
    "simulated_prevented_revert_count": 100,
    "simulated_prevented_revert_rate_pct": 100,
    "simulated_required_threshold_pct": 95
  },
  "route": {
    "chain": "base",
    "dex": "aerodrome-base",
    "pool_address": "0xcdac0d6c6c59727a65f871236188350531885c43",
    "pool_name": "USDC / WETH"
  },
  "warnings": [],
  "data_sources": ["geckoterminal:pools", "geckoterminal:pool_trades"]
}
```

## Method

The agent uses GeckoTerminal public pool and trade endpoints. It does not fabricate liquidity or trade distributions. If recent trade sampling fails, the response includes a warning and uses a fallback flow buffer.

For each candidate pool:

```text
effective_side_liquidity_usd = reserve_usd / 2
estimated_price_impact_bps = amount_usd / (effective_side_liquidity_usd + amount_usd) * 10000
min_safe_slip_bps = impact_bps + pool_fee_bps + volatility_buffer + recent_trade_flow_buffer + 10
```

`recent_trade_size_p95` is computed from the pool trade feed over `trade_window_hours` using `volume_in_usd`. The slippage recommendation is capped at 3000 bps to avoid returning a reckless tolerance.

The response also includes `backtest_summary`, a deterministic fixture check that covers deep, medium, thin, volatile, missing-trade-feed, and capped-tolerance scenarios. Each fixture compares `recommended_bps` against an explicit `required_bps` built from price impact, fee, volatility, recent-flow buffer, and safety margin. It also runs a 100-case deterministic simulated swap suite across amount, depth, fee, volatility, and recent-flow combinations. Current deterministic pass rate is 100%, `max_shortfall_bps = 0`, and `simulated_prevented_revert_rate_pct` is required to stay at or above 95%.

This is a safety estimator, not a guarantee. It is designed to reduce revert risk by accounting for pool depth and observed recent flow while making the evidence visible.

## Local Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Optional live sample:

```bash
SLIPPAGE_CHAIN=base \
SLIPPAGE_TOKEN_IN=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 \
SLIPPAGE_TOKEN_OUT=0x4200000000000000000000000000000000000006 \
SLIPPAGE_AMOUNT_IN=1000 \
SLIPPAGE_POOL_ADDRESS=0xcdac0d6c6c59727a65f871236188350531885c43 \
npm run slippage:sample
```

The route-hinted Base sample uses public RPC fallback when GeckoTerminal is unavailable from the deployment host. It should return live reserve depth, non-null `recent_trade_size_p95` when recent standard swap logs are present, `backtest_summary.pass_rate_pct = 100`, and `backtest_summary.simulated_prevented_revert_rate_pct >= 95`.

## x402

Current public deployment after merge/deploy:

- Base URL: `https://gpt55.558686.xyz/slippage-sentinel`
- Health: `https://gpt55.558686.xyz/slippage-sentinel/health`
- Agent manifest: `https://gpt55.558686.xyz/slippage-sentinel/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/slippage-sentinel/entrypoints/estimate_slippage/invoke`

The server exposes:

- `GET /health`
- `GET /.well-known/agent.json`
- `GET /entrypoints`
- `POST /entrypoints/estimate_slippage/invoke`
- `POST /entrypoints/slippage/invoke`
- `POST /entrypoints/slippage-sentinel/invoke`
- `POST /invoke`

If `X402_PAY_TO` is set, all invoke routes are protected by `@x402/express`. Unpaid protected POST requests return HTTP 402 with a PAYMENT-REQUIRED header.
