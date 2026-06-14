# GasRoute Oracle

`gasroute-oracle` estimates transaction cost across supported EVM chains and recommends the cheapest chain for a supplied gas load.

It does not request private keys, sign transactions, or broadcast transactions.

## Input

```json
{
  "chain_set": ["ethereum", "base", "polygon", "arbitrum", "optimism"],
  "calldata_size_bytes": 256,
  "gas_units_est": 120000
}
```

Supported chains: `ethereum`, `base`, `polygon`, `arbitrum`, `optimism`, `bsc`, `avalanche`.

## Output

```json
{
  "chain": "base",
  "fee_native": "0.00000123",
  "fee_usd": 0.0042,
  "busy_level": "low",
  "tip_hint": "0.01",
  "quotes": [],
  "warnings": [],
  "data_sources": [],
  "calculation_evidence": {
    "case_count": 4,
    "pass_count": 4,
    "pass_rate_pct": 100,
    "max_gas_error_pct": 0.077419,
    "within_5pct_case_count": 1,
    "within_5pct_pass_count": 1,
    "within_5pct_threshold_pct": 5
  }
}
```

Each quote includes base fee, priority fee, gas price, calldata gas units, total gas units, native token USD price, block number, and the RPC host used as evidence.

`calculation_evidence` verifies deterministic fee-model fixtures: calldata gas at 16 gas per byte, native fee multiplication, USD conversion, and estimated total gas compared with a receipt `gasUsed` fixture. The receipt fixture also reports explicit 5% accuracy coverage through `within_5pct_*` fields.

## Data Sources

- Public or configured EVM RPC: `eth_eth_feeHistory`, `eth_blockNumber`, and `eth_gasPrice` fallback.
- CoinGecko simple price API for native token USD conversion.

The oracle uses live RPC values. It does not claim to know wallet-specific execution gas; callers must provide `gas_units_est`. For EVM calldata, it uses a conservative non-zero byte cost of 16 gas per byte. This is deliberately conservative for the issue's `calldata_size_bytes` input.

## Fee Model

For each chain:

```text
total_gas_units = gas_units_est + calldata_size_bytes * 16
gas_price = latest_base_fee + suggested_priority_fee
fee_native = total_gas_units * gas_price
fee_usd = fee_native * native_token_usd
```

`busy_level` is derived from recent `eth_eth_feeHistory.gasUsedRatio` and short base-fee trend. `tip_hint` is based on recent fee-history reward percentiles when available, with a conservative fallback for legacy gas-price chains.

## Local Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Tests cover:

- calldata gas units and total gas units
- fee estimate multiplication by gas price
- priority-fee percentile selection
- busy-level classification
- base-fee trend calculation
- estimated gas vs receipt `gasUsed` error
- explicit within-5%-of-receipt accuracy evidence
- `calculation_evidence` 100% pass summary

Optional live scan:

```bash
GASROUTE_CHAIN_SET=ethereum,base,polygon,arbitrum,optimism \
GASROUTE_CALLDATA_SIZE_BYTES=256 \
GASROUTE_GAS_UNITS_EST=120000 \
npm run gasroute:sample
```

## x402

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/gasroute-oracle`
- Health: `https://gpt55.558686.xyz/gasroute-oracle/health`
- Agent manifest: `https://gpt55.558686.xyz/gasroute-oracle/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/gasroute-oracle/entrypoints/estimate_gas_route/invoke`
The server exposes:

- `GET /health`
- `GET /.well-known/agent.json`
- `GET /entrypoints`
- `POST /entrypoints/estimate_gas_route/invoke`
- `POST /entrypoints/gasroute/invoke`
- `POST /entrypoints/gas-route/invoke`
- `POST /invoke`

If `X402_PAY_TO` is set, all invoke routes are protected by `@x402/express`.

Local x402 smoke test:

```bash
PORT=8798 \
X402_PAY_TO=0x1f0130669ca6fd02e025a984cc038f139df19a2f \
X402_NETWORK=eip155:8453 \
X402_PRICE='$0.01' \
X402_FACILITATOR_URL=https://facilitator.openx402.ai \
PUBLIC_BASE_URL=http://127.0.0.1:8798 \
npm start
```

Public x402 smoke validation confirmed that unpaid POST requests to all protected invoke paths return HTTP 402 with a PAYMENT-REQUIRED header. The public manifest advertises Base x402 (eip155:8453) at $0.01 per request.

An unpaid protected POST should return HTTP 402 with a PAYMENT-REQUIRED header.
