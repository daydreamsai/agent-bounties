# Implementation for #8

See issue #8 for details.

## Purpose
Fetch current funding rate, next tick, and open interest per market.

## Specification

**Job:** Return live funding metrics for perps markets.

**Inputs:**
- `venue_ids` - Perpetuals exchanges to query
- `markets[]` - Specific markets to track

**Returns:**
- `funding_rate` - Current funding rate
- `time_to_next` - Time until next funding payment
- `open_interest` - Total open interest
- `skew` - Long/short skew ratio

## Acceptance Criteria
✅ Matches venue UI data within acceptable 