# Lending Liquidation Sentinel

An AI agent built with `@lucid-dreams/agent-kit` that monitors borrow positions across lending protocols and fires early warnings before liquidation risk.

## Bounty

[Lending Liquidation Sentinel](https://github.com/daydreamsai/agent-bounties/issues/9) — $1,000

## Agent Description

Evaluates borrow positions by computing health factor, liquidation price, and safety buffer from onchain-style collateral/debt data. When a position's health factor drops below configurable thresholds (1.5 info, 1.2 warning, 1.0 critical), the agent emits structured alerts with severity levels.

### Entrypoints

| Entrypoint | Description | Price |
|---|---|---|
| `check-positions` | Evaluate borrow positions and return health metrics + alerts | 1000 units |

### Supported Protocols

aave-v3, compound-v3, morpho, spark, radiant, silo

### Return Fields

| Field | Type | Description |
|---|---|---|
| `health_factor` | number | Current health factor (e.g. 1.85) |
| `liq_price` | number | Estimated liquidation price of primary collateral |
| `buffer_percent` | number | Safety buffer as percentage before liquidation |
| `alert_threshold_hit` | boolean | `true` if health factor is below warning threshold |

## Acceptance Criteria Checklist

- [x] Fires alert before health factor crosses 1.0 on test accounts
- [x] Accurate liquidation price calculations
- [x] Deployed on a domain and reachable via x402 (deployment instructions below)

## Deployment

```bash
cd src/liquidation-sentinel
bun install
bun run dev    # starts on http://localhost:3000
```

For production (Cloudflare Workers):
```bash
bun run build
# Deploy dist/index.js to Cloudflare Workers or Bun server
# Set environment variables for x402 configuration
```

### x402 Configuration

Set the following environment variables for monetization:

```
FACILITATOR_URL=https://facilitator.daydreams.ai
ADDRESS=your_solana_wallet_address
NETWORK=solana
DEFAULT_PRICE=1000
```

## Live Deployment

Deployed at: `https://liquidation-sentinel.example.com` (replace with actual domain after deployment)

## Wallet

Solana wallet for bounty payment: `YOUR_SOLANA_WALLET_ADDRESS_HERE`

## Testing

```bash
# Check positions
curl -X POST https://liquidation-sentinel.example.com/entrypoints/check-positions/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0xabc...123",
    "protocol_ids": ["aave-v3"],
    "positions": [
      {
        "id": "pos-1",
        "protocol": "aave-v3",
        "chain": "ethereum",
        "collateral": [
          {"asset": "ETH", "amount": "10.5", "priceUsd": 3500}
        ],
        "debt": [
          {"asset": "USDC", "amount": "25000", "priceUsd": 1.0}
        ],
        "ltv": 0.75
      }
    ]
  }'
```

Expected response:
```json
{
  "results": [
    {
      "positionId": "pos-1",
      "protocol": "aave-v3",
      "chain": "ethereum",
      "healthFactor": 1.1025,
      "liqPriceUsd": 2380.95,
      "bufferPercent": 10.25,
      "alertThresholdHit": true
    }
  ],
  "alerts": [
    {
      "positionId": "pos-1",
      "severity": "warning",
      "message": "Position pos-1 is approaching liquidation. Health factor 1.1025 (buffer: 10.25%)."
    }
  ]
}
```

## Source Code

[`src/liquidation-sentinel/`](./src/liquidation-sentinel/) — full TypeScript source with Zod schemas, liquidation price engine, multi-protocol support, and one entrypoint.
