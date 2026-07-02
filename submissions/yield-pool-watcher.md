# Yield Pool Watcher

## Agent Description

The Yield Pool Watcher is an DeFi monitoring agent that tracks APY (Annual Percentage Yield) and TVL (Total Value Locked) across multiple yield pools in real-time. It detects sharp changes in metrics and emits alerts when thresholds are breached.

## Live Deployment

- **URL**: https://yield-pool-watcher.vercel.app
- **x402 Endpoint**: https://yield-pool-watcher.vercel.app/x402

## Features

- Real-time monitoring of pool metrics (APY, TVL, utilization rate)
- Configurable threshold rules for alerts
- Delta tracking with historical comparison
- Support for major DeFi protocols (Aave, Compound, Curve, Uniswap V3)
- Block-level change detection
- Alert emission via webhook or x402 response

## Acceptance Criteria Checklist

- [x] Detects TVL or APY change beyond thresholds within 1 block
- [x] Accurate metric tracking across major protocols
- [x] Deployed on a domain and reachable via x402

## Technical Stack

- `@lucid-dreams/agent-kit` for agent framework
- `viem` for on-chain data fetching
- `defillama-api` for protocol data
- Deployed on Vercel with x402 middleware

## Solana Wallet Address

`your_solana_wallet_address_here`

## Additional Resources

- [DeFiLlama API Docs](https://defillama.com/api)
- [Aave Protocol Data Provider](https://docs.aave.com/developers/getting-started/protocol-data-provider)
- [Compound Protocol API](https://compound.finance/docs)