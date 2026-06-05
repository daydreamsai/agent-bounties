# Implementation for #3

See issue #3 for details.

## Purpose
Estimate safe slippage tolerance for any route to prevent swap reverts.

## Specification

**Job:** Suggest safe slippage for a specific swap route.

**Inputs:**
- `token_in` - Input token address
- `token_out` - Output token address
- `amount_in` - Amount to swap
- `route_hint` - Suggested route/DEX

**Returns:**
- `min_safe_slip_bps` - Minimum safe slippage in basis points
- `pool_depths` - Liquidity depth data for route
- `recent_trade_size_p95` - 95th percentile of recent trade si