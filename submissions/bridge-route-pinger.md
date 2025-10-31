# Bridge Route Pinger Agent

## Agent Description

The Bridge Route Pinger agent queries multiple bridge protocols (Stargate, Across, Hop, Wormhole) to find the best routes for cross-chain token transfers. It compares fees, estimated transfer times, and requirements across bridges to identify the cheapest and fastest options. The agent provides accurate fee and time estimates to help users optimize cross-chain transfers.

**Key Features:**
- Queries multiple bridge protocols simultaneously
- Compares fees in USD across bridges
- Estimates transfer times (ETA in minutes)
- Identifies best route (cheapest) and fastest route
- Lists requirements for each bridge
- Provides route count and metadata
- Accurate fee and time estimates

## Related Bounty Issue

[#10 - Bridge Route Pinger](https://github.com/daydreamsai/agent-bounties/issues/10)

## Live Deployment

**Deployment URL:** `https://x402.haxters.com/bridge-route-pinger`

**x402 Access:** Enabled

## Acceptance Criteria

- ✅ Queries major bridges (Stargate, Across, Hop, Wormhole)
- ✅ Returns accurate fee estimates
- ✅ Provides ETA estimates (0-180 minutes)
- ✅ Identifies best route and fastest route
- ✅ Lists requirements for each route
- ✅ Supports multiple chains
- ✅ All tests pass (8/8 tests)

## Entrypoint

**Key:** `find_routes`

**Input:**
```json
{
  "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "amount": "1000000",
  "from_chain": "ethereum",
  "to_chain": "polygon"
}
```

**Output:**
```json
{
  "routes": [...],
  "best_route": {...},
  "fastest_route": {...},
  "count": 4
}
```

## Solana Wallet

**Wallet Address:** `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`

## Technical Details

- Built with `@lucid-dreams/agent-kit`
- Queries bridge protocol APIs and contracts
- Compares fees across multiple bridges
- Estimates transfer times based on bridge characteristics
- Identifies optimal routes (cost and speed)
- Provides comprehensive route comparison

