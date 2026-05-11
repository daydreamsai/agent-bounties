# LP Impermanent Loss Estimator

Related bounty: #7

## Agent

LP Impermanent Loss Estimator calculates impermanent loss and fee APR for
V2-style LP pools using live reserve snapshots and observed swap volume.

## Live Deployment

- Agent URL: https://lp-impermanent-loss-estimator.doug-lance.workers.dev
- Manifest: https://lp-impermanent-loss-estimator.doug-lance.workers.dev/.well-known/agent.json
- Entrypoint: `estimate-lp-il`
- Invoke path: `POST /entrypoints/estimate-lp-il/invoke`

The deployment is reachable via x402. Unpaid invokes return HTTP 402 with
base-sepolia USDC payment requirements.

## Source

https://github.com/douglance/lp-impermanent-loss-estimator

## Supported Inputs

```json
{
  "pool_address": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
  "token_weights": [0.5, 0.5],
  "deposit_amounts": ["1000", "0.3"],
  "window_hours": 24,
  "chain": "ethereum"
}
```

Supported chains:

- `ethereum`
- `base`

## Output Summary

The agent returns:

- `IL_percent`
- `fee_apr_est`
- `volume_window`
- `pool`
- `deposit`
- `notes[]`
- `data_sources`
- `confidence`

## Acceptance Criteria Coverage

- Uses live JSON-RPC data through viem public clients.
- Reads V2 pair `token0`, `token1`, and current `getReserves`.
- Reads historical `getReserves` at an approximate window block for price-ratio IL.
- Reads ERC-20 `symbol` and `decimals`.
- Scans V2 `Swap` logs in chunks for observed volume during the requested window.
- Computes weighted two-token impermanent loss from reserve-ratio price movement.
- Estimates fee APR from observed swap volume, 30 bps pool fee, current pool reserve proxy, and the requested time window.
- Deployed on a public domain and reachable via x402.

## Validation

Local validation:

```text
npm run build
npm test
npm audit --audit-level=moderate
npx wrangler deploy --dry-run
```

Direct live RPC smoke against the Ethereum USDC/WETH pool:

```json
{
  "IL_percent": -0.0003,
  "fee_apr_est": 6.98,
  "swap_count": 944,
  "confidence": 1
}
```

Live endpoint checks:

```text
curl -fsS https://lp-impermanent-loss-estimator.doug-lance.workers.dev/health
-> {"ok":true,"version":"0.1.0"}

curl -fsS https://lp-impermanent-loss-estimator.doug-lance.workers.dev/.well-known/agent.json
-> manifest includes estimate-lp-il and x402 payments metadata

curl -i -X POST https://lp-impermanent-loss-estimator.doug-lance.workers.dev/entrypoints/estimate-lp-il/invoke \
  -H 'content-type: application/json' \
  -d '{"input":{"pool_address":"0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc","token_weights":[0.5,0.5],"deposit_amounts":["1000","0.3"],"window_hours":24,"chain":"ethereum"}}'
-> HTTP 402 with x402 payment requirements
```

## Payout Wallet

Solana: `EGNeDwAojepsbw4BTMXSERwYm3poirWQGfXEUh8yWofX`
