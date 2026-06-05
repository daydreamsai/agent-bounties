# Implementation for #9

See issue #9 for details.

## Purpose
Watch borrow positions and warn before liquidation risk.

## Specification

**Job:** Monitor health factor and trigger alerts near liquidation.

**Inputs:**
- `wallet` - Wallet address to monitor
- `protocol_ids` - Lending protocols to check
- `positions[]` - Specific positions to track

**Returns:**
- `health_factor` - Current health factor
- `liq_price` - Liquidation price threshold
- `buffer_percent` - Safety buffer percentage
- `alert_threshold_hit` - Boolean if alert should fire
