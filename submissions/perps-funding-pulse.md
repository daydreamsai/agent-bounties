# Perps Funding Pulse Agent

## Agent Description

The Perps Funding Pulse agent queries real-time funding rates, open interest, and time-to-next-funding for perpetual futures markets across multiple venues. It monitors funding rates (typically -1% to +1% per 8 hours), tracks open interest levels, calculates skew metrics, and provides time-to-next-funding countdowns. The agent enables traders to optimize funding rate arbitrage strategies.

**Key Features:**
- Queries multiple perpetual venues (GMX, Perpetual Protocol, dYdX)
- Returns real-time funding rates
- Tracks open interest levels
- Calculates market skew (0-1 range)
- Provides time-to-next-funding (0-28800 seconds)
- Supports multiple markets simultaneously

## Related Bounty Issue

[#8 - Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8)

## Live Deployment

**Deployment URL:** `https://x402.haxters.com/perps-funding-pulse`

**x402 Access:** Enabled

## Acceptance Criteria

- ✅ Returns real-time funding rates
- ✅ Provides open interest data
- ✅ Calculates time-to-next-funding (0-8 hours)
- ✅ Includes market skew metrics (0-1)
- ✅ Supports multiple venues
- ✅ All tests pass (6/6 tests)

## Entrypoint

**Key:** `get_funding_data`

**Input:**
```json
{
  "venue_ids": ["perpetual", "gmx"],
  "markets": ["ETH-USD"]
}
```

**Output:**
```json
{
  "funding_data": [{
    "venue": "...",
    "market": "...",
    "funding_rate": "0.0001",
    "time_to_next": 3600,
    "open_interest": "0",
    "skew": 0.5
  }]
}
```

## Solana Wallet

**Wallet Address:** `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`

## Technical Details

- Built with `@lucid-dreams/agent-kit`
- Uses `ethers.js` to query perpetual protocol contracts
- Fetches funding rate data from multiple venues
- Calculates time-to-next-funding from block timestamps
- Tracks open interest and market skew
- Provides real-time updates for funding rate monitoring

