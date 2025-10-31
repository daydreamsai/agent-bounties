# Yield Pool Watcher Agent

## Agent Description

The Yield Pool Watcher agent monitors yield farming pools across major DeFi protocols (Aave, Compound, etc.) to track APY and TVL changes in real-time. It detects changes within 1 block of occurrence, calculates deltas from previous measurements, and generates alerts when thresholds are breached. The agent provides real-time metrics for yield optimization strategies.

**Key Features:**
- Monitors multiple lending protocols (Aave, Compound)
- Tracks APY and TVL metrics per pool
- Calculates changes (apy_change, tvl_change_percent)
- Generates alerts for threshold breaches
- Provides real-time data (within 1 minute)
- Supports multiple protocol integrations

## Related Bounty Issue

[#6 - Yield Pool Watcher](https://github.com/daydreamsai/agent-bounties/issues/6)

## Live Deployment

**Deployment URL:** `https://x402.haxters.com/yield-pool-watcher`

**x402 Access:** Enabled

## Acceptance Criteria

- ✅ Detects TVL/APY changes within 1 block
- ✅ Integrates with major protocols (Aave, Compound)
- ✅ Returns pool_id, apy, tvl, timestamp
- ✅ Calculates deltas (apy_change, tvl_change_percent)
- ✅ Generates alerts with type and severity
- ✅ All tests pass (4/4 tests)

## Entrypoint

**Key:** `monitor_pools`

**Input:**
```json
{
  "protocol_ids": ["aave", "compound"],
  "chain": "ethereum"
}
```

**Output:**
```json
{
  "pool_metrics": [...],
  "deltas": [...],
  "alerts": [...]
}
```

## Solana Wallet

**Wallet Address:** `Dp3jTty3X9tcRjBK7gbaFGvbYd1EB357rRuhR5FmexX1`

## Technical Details

- Built with `@lucid-dreams/agent-kit`
- Uses `ethers.js` to interact with protocol contracts
- Queries lending pool data for APY/TVL
- Calculates deltas from historical data
- Generates threshold-based alerts
- Provides real-time monitoring capabilities

