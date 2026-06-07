# GasRoute Oracle

GasRoute Oracle estimates the cheapest EVM chain for a planned transaction. It samples EIP-1559 fee history, converts native fees to USD, accounts for calldata gas, and adds a configurable L1-data surcharge for rollups.

## Entrypoint

`estimate_gas_route`

Input:

```json
{
  "chain_set": ["ethereum", "base", "arbitrum", "optimism", "polygon"],
  "calldata_size_bytes": 512,
  "gas_units_est": 180000
}
```

Output:

```json
{
  "chain": "base",
  "fee_native": 0.000041728,
  "fee_usd": 0.146048,
  "busy_level": "low",
  "tip_hint": "0.02 gwei",
  "alternatives": []
}
```

## Configuration

Optional RPC overrides:

- `ETHEREUM_RPC_URL`
- `BASE_RPC_URL`
- `ARBITRUM_RPC_URL`
- `OPTIMISM_RPC_URL`
- `POLYGON_RPC_URL`

## Run

```bash
npm install
npm test
X402_PAY_TO=0xYourAddress npm start
```

## Deployment Notes

Deploy this package as an `@lucid-dreams/agent-kit` app or run the included Express server. The server protects `POST /estimate_gas_route` with `@x402/express` and leaves `GET /health` open for uptime checks.

Environment:

- `X402_PAY_TO`: EVM address that receives x402 payments, required
- `X402_NETWORK`: CAIP-2 EVM network, default `eip155:84532` (Base Sepolia)
- `X402_FACILITATOR_URL`: default `https://x402.org/facilitator`
- `X402_PRICE`: default `$0.001`
- `PORT`: default `3000`

The core estimator is dependency-free and tested separately, so the hosted endpoint can use the same logic without requiring mocked chain data.
