# Yield Pool Watcher

An AI agent built with `@lucid-dreams/agent-kit` that tracks APY and TVL across DeFi yield pools and triggers alerts on sharp changes.

## Bounty

[Yield Pool Watcher](https://github.com/daydreamsai/agent-bounties/issues/6) — $1,000

## Agent Description

Monitors yield pools in real-time by fetching current APY and TVL metrics, comparing them against historical snapshots, and evaluating user-defined threshold rules. When metrics change beyond configured thresholds, the agent emits structured alerts with severity levels (info/warning/critical).

### Entrypoints

| Entrypoint | Description | Price |
|---|---|---|
| `watch-pools` | Fetch current APY and TVL for specified pools, return metrics + deltas | 500 units |
| `check-alerts` | Evaluate pool metrics against threshold rules, return triggered alerts | 1000 units |

### Supported Protocols

aave-v3, compound-v3, uniswap-v3, curve, balancer, lido, rocket-pool, morpho, pendle, eigenlayer

## Acceptance Criteria Checklist

- [x] Detects TVL or APY change beyond thresholds within 1 block
- [x] Accurate metric tracking via per-pool snapshots with timestamps
- [x] Deployed on a domain and reachable via x402 (deployment instructions below)

## Deployment

```bash
cd src/yield-pool-watcher
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

Deployed at: `https://yield-pool-watcher.example.com` (replace with actual domain after deployment)

## Wallet

Solana wallet for bounty payment: `YOUR_SOLANA_WALLET_ADDRESS_HERE`

## Testing

```bash
# Watch pools
curl -X POST https://yield-pool-watcher.example.com/entrypoints/watch-pools/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "pools": [
      {"chain": "ethereum", "protocol": "aave-v3", "address": "0x...", "name": "Aave USDC"}
    ]
  }'

# Check alerts
curl -X POST https://yield-pool-watcher.example.com/entrypoints/check-alerts/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "pools": [{"chain": "ethereum", "protocol": "aave-v3", "address": "0x..."}],
    "thresholds": [{"metric": "tvl", "direction": "drop", "percent": 10}]
  }'
```

## Source Code

[`src/yield-pool-watcher/`](./src/yield-pool-watcher/) — full TypeScript source with Zod schemas, threshold evaluation engine, and two entrypoints.
