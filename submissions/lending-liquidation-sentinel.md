# Lending Liquidation Sentinel Agent

## Agent Description

The Lending Liquidation Sentinel agent monitors lending positions across multiple protocols (Aave, Compound) to calculate health factors and liquidation prices. It triggers alerts when health factors approach dangerous levels (<1.1) and identifies the most at-risk positions. The agent helps users avoid liquidation by providing early warnings and buffer percentage calculations.

**Key Features:**
- Monitors lending positions across Aave and Compound
- Calculates health factors (0-10 range typically)
- Determines liquidation prices
- Calculates buffer percentages
- Triggers alerts when HF < 1.1
- Identifies most at-risk position
- Provides any_alert flag for quick status checks

## Related Bounty Issue

[#9 - Lending Liquidation Sentinel](https://github.com/daydreamsai/agent-bounties/issues/9)

## Live Deployment

**Deployment URL:** `https://x402.haxters.com/lending-liquidation-sentinel`

**x402 Access:** Enabled

## Acceptance Criteria

- ✅ Alerts when health factor < 1.1
- ✅ Calculates accurate health factors
- ✅ Provides liquidation prices
- ✅ Calculates buffer percentages
- ✅ Identifies most at-risk position
- ✅ Supports multiple protocols
- ✅ All tests pass (5/5 tests)

## Entrypoint

**Key:** `monitor_position`

**Input:**
```json
{
  "wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "protocol_ids": ["aave", "compound"]
}
```

**Output:**
```json
{
  "positions": [...],
  "any_alert": false,
  "most_at_risk": null
}
```

## Solana Wallet

**Wallet Address:** `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`

## Technical Details

- Built with `@lucid-dreams/agent-kit`
- Uses `ethers.js` to query lending protocol contracts
- Calculates health factors from collateral/borrow ratios
- Determines liquidation prices based on LTV thresholds
- Calculates buffer percentages before liquidation
- Provides comprehensive position monitoring

