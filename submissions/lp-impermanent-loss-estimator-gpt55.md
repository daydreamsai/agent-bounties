# LP Impermanent Loss Estimator

## Related Bounty

Issue: #7 - LP Impermanent Loss Estimator

## Agent

Implementation path: `submissions/lp-impermanent-loss-estimator`

The agent estimates LP impermanent loss and fee APR from observed AMM pool price, volume, and TVL data. It supports equal-weight and weighted pool math and returns explicit `notes` when a data source cannot support part of the estimate.

Primary data comes from GeckoTerminal pool metadata and OHLCV. When GeckoTerminal is unavailable from a deployment network, the implementation falls back to public EVM RPC plus DefiLlama token charts for pool tokens, fee tier, current balances, TVL, and price-ratio IL. It does not fabricate pool volume; `fee_apr_est` remains `null` when no reliable pool-volume source is reachable.

## Inputs

- `pool_address`: EVM pool address
- `network`: GeckoTerminal network id, for example `eth`, `base`, `arbitrum`
- `token_weights`: token weight distribution, for example `[0.5, 0.5]` or `[0.8, 0.2]`
- `deposit_amounts`: supplied token amounts
- `window_hours`: historical window for observed price/volume
- `fee_bps`: pool fee tier in basis points; defaults to 30 bps when omitted

## Outputs

- `IL_percent`
- `fee_apr_est`
- `volume_window`
- `tvl_usd`
- `net_apr_after_il_est`
- `price_ratio_start`
- `price_ratio_end`
- `notes`
- `data_sources`
- `confidence`

## Method

- Impermanent loss uses weighted CFMM math:
  - pool relative value is the product of `price_relative_i ^ weight_i`
  - hold relative value is the sum of `weight_i * price_relative_i`
  - `IL_percent = (pool_relative / hold_relative - 1) * 100`
- For two-token AMMs, GeckoTerminal OHLCV close price is used as the observed pool price ratio over the requested window.
- Fee APR uses observed volume and TVL:
  - `(volume_window * fee_bps / 10000 / tvl_usd) * (24 / window_hours) * 365 * 100`
- No synthetic volume, TVL, or price history is fabricated.

## Validation

```bash
cd submissions/lp-impermanent-loss-estimator
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
IL_POOL_ADDRESS=0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 IL_NETWORK=eth IL_WINDOW_HOURS=24 IL_FEE_BPS=5 npm run il:sample
```

Local validation on 2026-06-14:

- `npm run build` passed
- `npm test` passed, 12/12 tests
- `npm run lint` passed
- `npm audit --audit-level=moderate` passed, 0 vulnerabilities
- Live GeckoTerminal sample for Ethereum USDC/WETH 0.05% pool `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` returned `IL_percent=-0.000184`, `fee_apr_est=3.060393`, `volume_window=14468842.37`, `tvl_usd=86281858.89`, `fee_bps_used=5`, `confidence=1`, and data sources `geckoterminal:ohlcv:eth` plus `geckoterminal:pool:eth`.
- Deployed Beijing-server sample uses the fallback path because GeckoTerminal is unreachable from that network. It returned `IL_percent=-0.000144`, `tvl_usd=86254231.99`, `fee_bps_used=5`, `confidence=0.75`, and data sources `rpc:eth` plus `defillama:coins:ethereum`; `fee_apr_est` stayed `null` because no reliable pool-volume source was reachable.

Tests cover equal-weight IL math, weighted pool behavior, fee APR annualization, input validation, OHLCV price movement, volume-window aggregation, and ABI decoding for the on-chain fallback.

## Deployment / x402

Public deployment:

- Base URL: `https://gpt55.558686.xyz/lp-impermanent-loss-estimator`
- Health: `https://gpt55.558686.xyz/lp-impermanent-loss-estimator/health`
- Manifest: `https://gpt55.558686.xyz/lp-impermanent-loss-estimator/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/lp-impermanent-loss-estimator/entrypoints/estimate_lp_il/invoke`
- Short alias: `POST https://gpt55.558686.xyz/lp-impermanent-loss-estimator/entrypoints/lp-il/invoke`
- Hyphenated alias: `POST https://gpt55.558686.xyz/lp-impermanent-loss-estimator/entrypoints/impermanent-loss/invoke`
- Legacy alias: `POST https://gpt55.558686.xyz/lp-impermanent-loss-estimator/invoke`

The server includes `@x402/express` protection for all invoke routes when `X402_PAY_TO` is configured.

Deployment validation on 2026-06-14:

- `GET https://gpt55.558686.xyz/lp-impermanent-loss-estimator/health` returned HTTP 200
- `GET https://gpt55.558686.xyz/lp-impermanent-loss-estimator/.well-known/agent.json` returned HTTP 200
- Unpaid `POST https://gpt55.558686.xyz/lp-impermanent-loss-estimator/entrypoints/estimate_lp_il/invoke` returned HTTP 402
- `lp-impermanent-loss-estimator` is present in `https://gpt55.558686.xyz/.well-known/x402` and `https://gpt55.558686.xyz/x402/live-prices.json`

## Payout Wallet

`0x1f0130669ca6fd02e025a984cc038f139df19a2f`
