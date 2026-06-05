# Implementation for #2

See issue #2 for details.

## Purpose
Flag price spreads across DEXs after fees and gas to spot profitable swaps.

## Specification

**Job:** Detect cross-DEX token price spreads exceeding threshold.

**Inputs:**
- `token_in` - Input token address
- `token_out` - Output token address
- `amount_in` - Amount to swap
- `chains` - Chains to scan for arbitrage

**Returns:**
- `best_route` - Optimal arbitrage route
- `alt_routes` - Alternative profitable routes
- `net_spread_bps` - Net spread in basis points
- `est_fill_cost` -