# Yield Pool Watcher Submission

## Agent Description

The Yield Pool Watcher is an autonomous AI agent that monitors DeFi yield pools in real-time, tracking APY and TVL metrics across major protocols. It detects sharp changes beyond configured thresholds and emits alerts within one block of detection.

## Live Deployment

**Domain:** https://yield-pool-watcher.vercel.app  
**x402 Endpoint:** https://yield-pool-watcher.vercel.app/api/x402  
**Health Check:** https://yield-pool-watcher.vercel.app/api/health

## Acceptance Criteria Checklist

- [x] Detects TVL or APY change beyond thresholds within 1 block
- [x] Accurate metric tracking across major protocols (Aave, Compound, Lido, Uniswap V3, Curve)
- [x] Deployed on a domain and reachable via x402

## Entrypoints

### `monitor`
Monitors specified pools and returns current metrics, deltas, and alerts.

**Input:**
