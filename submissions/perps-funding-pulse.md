# Perps Funding Pulse Submission

## Agent Description
Fetches live funding metrics for perpetual markets across major venues.

## Live Deployment
- **URL:** https://perps-funding-pulse.vercel.app
- **x402 reachable:** Yes

## Acceptance Criteria Checklist
- [x] Fetch current funding rate per market
- [x] Return time to next funding tick
- [x] Return open interest per market
- [x] Calculate long/short skew ratio
- [x] Matches venue UI data within acceptable tolerance
- [x] Real-time or near real-time data updates
- [x] Deployed on domain and reachable via x402

## Technical Details
- Uses `@daydreamsai/agent-kit` for agent framework
- Polls Hyperliquid, dYdX, and GMX APIs for funding data
- Normalizes responses to common schema with funding_rate, time_to_next, open_interest, skew

## Solana Wallet Address
`YourSolanaWalletAddressHere`

## Additional Resources
- [Daydreams Agent Kit](https://www.npmjs.com/package/@daydreamsai/agent-kit)
- [Bounty Issue #8](https://github.com/daydreamsai/agent-bounties/issues/8)