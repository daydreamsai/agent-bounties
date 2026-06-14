# Bridge Route Pinger

`bridge-route-pinger` returns live cross-chain bridge quotes from LI.FI's official API, including ETA, gas fees, bridge fees, output amounts, and execution requirements.

It does not request wallet private keys, sign transactions, or broadcast bridge transactions.

## Input

```json
{
  "token": "ETH",
  "amount": "0.001",
  "from_chain": "base",
  "to_chain": "optimism",
  "from_address": "0x0000000000000000000000000000000000000001",
  "slippage": 0.005
}
```

Common supported chain aliases include `ethereum`, `base`, `optimism`, `polygon`, `arbitrum`, `avalanche`, `scroll`, and `linea`. Common token symbols include `ETH`, `USDC`, and `USDT`; custom token addresses are accepted with an 18-decimal assumption.

## Output

```json
{
  "routes": [],
  "best_route": null,
  "warnings": [],
  "data_sources": ["lifi:v1:quote"],
  "calculation_evidence": {
    "case_count": 3,
    "pass_count": 3,
    "pass_rate_pct": 100
  },
  "fetched_at": "2026-06-14T00:00:00.000Z"
}
```

Each route includes the bridge/tool, source/destination chain and token, input/output amounts, minimum output, USD input/output estimates, ETA minutes, gas fee USD, bridge fee USD, total fee USD, requirements, and included route steps.

`calculation_evidence` verifies deterministic route normalization and ranking fixtures: fee split to total fee, ETA handling, best route by output after total fees, and lower-fee fallback when USD output is unavailable.

## Data Source

- LI.FI `/v1/quote`, which aggregates official bridge/tool quote data and includes fee, gas, and execution-duration estimates.

The service reports LI.FI's current quote values and does not fabricate extra routes or hidden fee estimates.

## Local Validation

```bash
npm install
npm run build
npm test
npm run lint
npm audit --audit-level=moderate
```

Tests cover input validation, chain/token resolution, decimal amount conversion, LI.FI quote normalization, best-route ranking, and route calculation evidence.

Optional live quote:

```bash
BRIDGE_TOKEN=ETH \
BRIDGE_AMOUNT=0.001 \
BRIDGE_FROM_CHAIN=base \
BRIDGE_TO_CHAIN=optimism \
npm run bridge:sample
```

## x402

Current public deployment:

- Base URL: `https://gpt55.558686.xyz/bridge-route-pinger`
- Health: `https://gpt55.558686.xyz/bridge-route-pinger/health`
- Agent manifest: `https://gpt55.558686.xyz/bridge-route-pinger/.well-known/agent.json`
- Canonical invoke: `POST https://gpt55.558686.xyz/bridge-route-pinger/entrypoints/ping_bridge_routes/invoke`

Protected invoke aliases:

- `POST /entrypoints/ping_bridge_routes/invoke`
- `POST /entrypoints/bridge-routes/invoke`
- `POST /entrypoints/bridge/invoke`
- `POST /invoke`
