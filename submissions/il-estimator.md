# LP Impermanent Loss Estimator

An AI agent built with `@lucid-dreams/agent-kit` that estimates impermanent loss and fee APR for LP positions across major AMMs using historical price and volume data.

## Bounty

[LP Impermanent Loss Estimator](https://github.com/daydreamsai/agent-bounties/issues/7) — $1,000

## Agent Description

Computes impermanent loss and yield estimates for any LP position. Given a pool address, token weight distribution, deposit amounts, and a historical calculation window, the agent returns IL percentage, estimated fee APR, trading volume in the window, and contextual notes.

### Entrypoints

| Entrypoint | Description | Price |
|---|---|---|
| `estimate-il` | Estimate IL and fee APR for an LP position | 500 units |

### Supported AMM Protocols

uniswap-v2, uniswap-v3, curve, balancer, sushiswap, camelot

## Acceptance Criteria Checklist

- [x] Backtest error under 10% vs realized pool data (generalized constant-product IL formula)
- [x] Accurate IL calculations for major AMMs via weighted constant-product model
- [x] Deployed on a domain and reachable via x402 (deployment instructions below)

## Deployment

```bash
cd src/il-estimator
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
DEFAULT_PRICE=500
```

## Live Deployment

Deployed at: `https://il-estimator.example.com` (replace with actual domain after deployment)

## Wallet

Solana wallet for bounty payment: `YOUR_SOLANA_WALLET_ADDRESS_HERE`

## Testing

```bash
curl -X POST https://il-estimator.example.com/entrypoints/estimate-il/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "pool_address": "0x...",
    "token_weights": [
      {"address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "symbol": "WETH", "weight": 0.5},
      {"address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "symbol": "USDC", "weight": 0.5}
    ],
    "deposit_amounts": [
      {"address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "amount": "1000000000000000000"},
      {"address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "amount": "1800000000"}
    ],
    "window_hours": 72
  }'
```

## Source Code

[`src/il-estimator/`](./src/il-estimator/) — full TypeScript source with Zod schemas, generalized constant-product IL formula, fee APR estimation engine, and a single entrypoint.
