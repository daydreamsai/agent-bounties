# LP Impermanent Loss Estimator Agent

## Agent Description

The LP Impermanent Loss Estimator agent calculates impermanent loss (IL) for liquidity providers based on token price movements and estimates fee APR from pool volumes. It uses historical price data and trading volumes to provide accurate IL calculations with backtest error <10%. The agent helps LPs understand potential risks and returns before providing liquidity.

**Key Features:**
- Calculates impermanent loss percentage
- Estimates fee APR from trading volumes
- Provides volume window analysis
- Includes backtesting validation
- Generates informative notes and warnings
- Accurate calculations with <10% backtest error

## Related Bounty Issue

[#7 - LP Impermanent Loss Estimator](https://github.com/daydreamsai/agent-bounties/issues/7)

## Live Deployment

**Deployment URL:** `https://x402.haxters.com/lp-impermanent-loss-estimator`

**x402 Access:** Enabled

## Acceptance Criteria

- ✅ Calculates IL_percent (0-100%)
- ✅ Estimates fee_apr_est (non-negative)
- ✅ Provides volume_window data
- ✅ Backtest error <10%
- ✅ Includes notes array with explanations
- ✅ All tests pass (5/5 tests)

## Entrypoint

**Key:** `estimate_il`

**Input:**
```json
{
  "token0": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "token1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "price_change_pct": "0"
}
```

**Output:**
```json
{
  "IL_percent": "0",
  "fee_apr_est": "0",
  "volume_window": "7d",
  "notes": [...]
}
```

## Solana Wallet

**Wallet Address:** `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`

## Technical Details

- Built with `@lucid-dreams/agent-kit`
- Uses `ethers.js` for pool data queries
- Calculates IL using standard formulas
- Estimates fees from volume data
- Provides contextual notes and warnings
- Validates calculations through backtesting

