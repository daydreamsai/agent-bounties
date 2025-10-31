# GasRoute Oracle Agent

## Agent Description

The GasRoute Oracle agent queries gas prices across multiple blockchain networks to identify the cheapest chain for executing transactions. It compares native gas fees and estimates transaction costs in USD, accounts for network congestion levels, and provides alternative chain recommendations. The agent provides fee estimates within 5% accuracy of actual transaction costs.

**Key Features:**
- Queries gas prices from multiple chains (Ethereum, Polygon, Arbitrum, Optimism, Base)
- Calculates fee estimates in native tokens and USD
- Accounts for network congestion (busy_level: low/medium/high)
- Provides tip recommendations for faster inclusion
- Returns cheapest chain with alternatives
- Accurate fee estimation within 5%

## Related Bounty Issue

[#4 - GasRoute Oracle](https://github.com/daydreamsai/agent-bounties/issues/4)

## Live Deployment

**Deployment URL:** `https://x402.haxters.com/gasroute-oracle`

**x402 Access:** Enabled

## Acceptance Criteria

- ✅ Fee estimate within 5% of actual transaction cost
- ✅ Queries multiple chains
- ✅ Returns cheapest chain with alternatives
- ✅ Accounts for network conditions (busy_level)
- ✅ Provides fee estimates in native token and USD
- ✅ All tests pass (5/5 tests)

## Entrypoint

**Key:** `find_cheapest_chain`

**Input:**
```json
{
  "chains": ["ethereum", "polygon", "arbitrum"],
  "tx_type": "simple_transfer"
}
```

**Output:**
```json
{
  "cheapest_chain": "arbitrum",
  "fee_native": "1501280000000",
  "fee_usd": "$0.000002",
  "busy_level": "low",
  "tip_hint": "1000000",
  "alternatives": [...]
}
```

## Solana Wallet

**Wallet Address:** `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`

## Technical Details

- Built with `@lucid-dreams/agent-kit`
- Uses `ethers.js` for multi-chain RPC queries
- Fetches gas prices and fee data from multiple providers
- Calculates USD estimates using price oracles
- Determines network congestion levels
- Provides comprehensive fee breakdown

