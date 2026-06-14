# LP Impermanent Loss Estimator

`lp-impermanent-loss-estimator` estimates impermanent loss and fee APR for an LP pool using observed AMM pool price, volume, and TVL data. It does not request private keys, does not sign transactions, and does not broadcast transactions.

The primary data source is GeckoTerminal pool metadata and OHLCV. If GeckoTerminal is unavailable from the deployment network, the agent falls back to public EVM RPC plus DefiLlama token price charts for pool token discovery, fee tier, TVL, and price-ratio IL. It leaves `volume_window` and `fee_apr_est` as `null` when no reliable pool-volume source is reachable.

## Input

```json
{
  "pool_address": "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
  "network": "eth",
  "token_weights": [0.5, 0.5],
  "deposit_amounts": [1, 1],
  "window_hours": 24,
  "fee_bps": 5
}
```

Supported GeckoTerminal networks: `eth`, `base`, `polygon_pos`, `arbitrum`, `optimism`, `bsc`, `avalanche`, `gnosis`, `fantom`.

## Output

```json
{
  "IL_percent": -0.0123,
  "fee_apr_est": 18.4,
  "volume_window": 1234567.89,
  "tvl_usd": 98765432.1,
  "net_apr_after_il_est": 13.9,
  "notes": [],
  "data_sources": ["geckoterminal:ohlcv:eth", "geckoterminal:pool:eth"],
  "backtest_summary": {
    "case_count": 6,
    "pass_count": 6,
    "pass_rate_pct": 100,
    "max_relative_error_pct": 0,
    "relative_error_threshold_pct": 10
  },
  "confidence": 0.95
}
```

## Method

- Impermanent loss uses the weighted constant-function market maker formula:
  - pool relative value: product of `price_relative_i ^ weight_i`
  - hold relative value: sum of `weight_i * price_relative_i`
  - `IL_percent = (pool_relative / hold_relative - 1) * 100`
- For standard two-token pools, the live pool OHLCV close price is used as the observed token price ratio over `window_hours`.
- Fee APR uses observed volume and TVL:
  - `fee_apr_est = (volume_window * fee_bps / 10000 / tvl_usd) * (24 / window_hours) * 365 * 100`
- `net_apr_after_il_est` annualizes the observed window IL drag and adds the observed-window fee APR estimate.
- `backtest_summary` is a deterministic analytical fixture check for the IL formula. It compares the runtime estimator math against known 50/50 constant-product and weighted-pool results, including 4x, 0.25x, 1.21x, equal-move, and small-move cases. Current fixtures require all nonzero cases to stay below 10% relative error.

## Data Sources

- GeckoTerminal pool endpoint for reserve/TVL and volume windows.
- GeckoTerminal OHLCV endpoint for observed pool price movement and window volume.
- Public EVM RPC fallback for pool `token0`, `token1`, fee tier, ERC20 decimals, and pool balances.
- DefiLlama token chart fallback for historical token prices and TVL estimation.

The implementation does not fabricate historical pool data. If price, volume, or TVL is unavailable, the corresponding output is `0` or `null` and the reason is returned in `notes`.

## Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Live sample:

```bash
IL_POOL_ADDRESS=0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 \
IL_NETWORK=eth \
IL_WINDOW_HOURS=24 \
IL_FEE_BPS=5 \
npm run il:sample
```

Tests cover:

- equal-weight constant product IL against a known 4x price-move result
- equal-weight constant product IL against known 0.25x and 1.21x price-move results
- weighted 80/20 IL against an independent expected fixture
- deterministic backtest summary with 100% pass rate and max relative error below 10%
- weighted pool normalization and zero-IL equal-price movement
- fee APR annualization from observed volume/TVL
- input validation
- OHLCV price-relative and volume-window handling
- ABI address/uint decoding and ERC20 unit formatting for the on-chain fallback

## x402

The server exposes:

- `GET /health`
- `GET /.well-known/agent.json`
- `GET /entrypoints`
- `POST /entrypoints/estimate_lp_il/invoke`
- `POST /entrypoints/lp-il/invoke`
- `POST /entrypoints/impermanent-loss/invoke`
- `POST /invoke`

If `X402_PAY_TO` is set, invoke routes are protected by `@x402/express`.
