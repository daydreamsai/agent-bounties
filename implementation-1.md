# Implementation for #1

See issue #1 for details.

## Purpose
List new AMM pairs or pools in the last few minutes for discovery bots or yield scouts.

## Specification

**Job:** List new AMM pairs or pools in the last N minutes.

**Inputs:**
- `chain` - Target blockchain
- `factories` - AMM factory contracts to monitor
- `window_minutes` - Time window to scan

**Returns:**
- `pair_address` - Address of new pair/pool
- `tokens` - Token addresses in the pair
- `init_liquidity` - Initial liquidity amount
- `top_holders` - Top holder addresses
- `cr