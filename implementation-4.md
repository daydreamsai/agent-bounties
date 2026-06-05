# Implementation for #4

See issue #4 for details.

## Purpose
Choose cheapest chain and timing hint for a swap or contract call.

## Specification

**Job:** Return best chain and time estimate for given gas load.

**Inputs:**
- `chain_set` - Set of chains to consider
- `calldata_size_bytes` - Size of calldata
- `gas_units_est` - Estimated gas units needed

**Returns:**
- `chain` - Recommended chain
- `fee_native` - Fee in native token
- `fee_usd` - Fee in USD
- `busy_level` - Network congestion level
- `tip_hint` - Suggested priority fee

## Acc