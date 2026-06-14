# Cross DEX Arbitrage Alert

`cross-dex-arbitrage-alert` scans V2-style DEX pools for a token pair, compares live reserve quotes, validates configured routes against router `getAmountsOut`, subtracts DEX fees and estimated swap gas, and returns profitable cross-DEX spreads.

It uses public EVM RPC calls against factory and pair contracts. It does not fabricate quotes from price APIs. DefiLlama is only used for USD/token conversion of gas cost.

## Input

```json
{
  "token_in": "0x4200000000000000000000000000000000000006",
  "token_out": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount_in": "1",
  "chains": ["base"],
  "threshold_bps": 0,
  "max_routes": 10
}
```

Supported chains: `base`, `eth`.

## Output

- `best_route`: highest net spread opportunity
- `alt_routes`: other opportunities above `threshold_bps`
- `net_spread_bps`: best net spread after gas when gas conversion is available
- `est_fill_cost`: estimated gas cost in token-out terms
- `quotes`: raw DEX quotes with pair address, amount out, optional router `getAmountsOut` parity fields, fee bps, gas, and block
- `warnings`: unavailable pools or failed quote sources
- `data_sources`: RPC and price sources used
- `calculation_evidence`: deterministic fixture summary showing profitable and non-profitable route handling
- `confidence`: simple coverage score

## Method

- Reads `getPair(token_in, token_out)` from known V2 factories.
- Reads `token0`, `token1`, and `getReserves()` from the pair.
- Computes exact constant-product amount out:
  - `amountInWithFee = amount_in * (10000 - fee_bps)`
  - `amount_out = amountInWithFee * reserveOut / (reserveIn * 10000 + amountInWithFee)`
- For configured V2 routers, calls `getAmountsOut(amount_in, [token_in, token_out])` and reports `router_amount_out` plus `router_quote_error_pct`; this is the live on-chain quote parity check used to verify the reserve calculation stays within the 1% acceptance threshold.
- Reads `eth_gasPrice`, applies per-DEX swap gas units, and converts to token-out terms using DefiLlama prices when available.
- Ranks routes by net output after gas and reports net spread in basis points.

## Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
ARB_TOKEN_IN=0x4200000000000000000000000000000000000006 ARB_TOKEN_OUT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 ARB_AMOUNT_IN=1 ARB_CHAINS=base npm run arb:sample
```

Tests cover constant-product fee math, spread calculation, unit parsing/formatting, ABI address/uint handling, and V2 router `getAmountsOut` calldata/result decoding.
They also cover deterministic arbitrage evidence so a large one-way quote spread is not mistaken for a profitable round trip.

## x402

The server exposes:

- `GET /health`
- `GET /.well-known/agent.json`
- `GET /entrypoints`
- `POST /entrypoints/detect_arbitrage/invoke`
- `POST /entrypoints/detect-spread/invoke`
- `POST /invoke`

If `X402_PAY_TO` is set, invoke routes are protected by `@x402/express`.
