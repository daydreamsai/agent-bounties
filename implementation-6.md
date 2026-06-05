# Implementation for #6

See issue #6 for details.

## Purpose
Track APY and TVL across pools and alert on sharp changes.

## Specification

**Job:** Monitor pool metrics and emit alerts on spikes or drains.

**Inputs:**
- `protocol_ids` - DeFi protocols to monitor
- `pools[]` - Specific pools to watch
- `threshold_rules` - Alert threshold configuration

**Returns:**
- `pool_metrics` - Current APY, TVL, and other metrics
- `deltas` - Change metrics over time
- `alerts[]` - Triggered alerts based on thresholds

## Acceptance Criteria
✅ Detects TVL