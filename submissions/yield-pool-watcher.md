# Yield Pool Watcher - Bounty #6 Submission

## Agent Information

**Name:** Yield Pool Watcher

**Description:** Track APY and TVL across DeFi pools and alert on sharp changes. Monitors yield pools in real-time, calculates deltas, and generates alerts when metrics breach configurable thresholds.

**Live Endpoint:** https://yield-pool-watcher-production.up.railway.app/entrypoints/yield-pool-watcher/invoke

## Acceptance Criteria

- ✅ **Detects TVL or APY change beyond thresholds within 1 block**
  - Real-time pool monitoring with configurable intervals
  - Calculates deltas for 5min, 15min, 60min windows
  - Alerts triggered on TVL drain/spike and APY changes
  - Historical snapshot tracking for comparison

- ✅ **Accurate metric tracking across major protocols**
  - Uniswap V2/V3 (multi-chain)
  - SushiSwap (multi-chain)
  - Aave V3 lending pools
  - Curve Finance (Ethereum, Polygon, Arbitrum, Optimism)
  - PancakeSwap (BSC)
  - TraderJoe (Avalanche)
  - TVL calculated from reserves × token prices
  - APY calculated from fees (DEX) or rates (lending)

- ✅ **Deployed on a domain and reachable via x402**
  - Deployed: https://yield-pool-watcher-production.up.railway.app
  - Implements AP2 (Agent Payments Protocol)
  - Full x402 protocol compliance
  - Registered on x402scan ✅

## Implementation Details

### Technology Stack
- **Framework:** Python, FastAPI, Web3.py
- **Deployment:** Railway (Docker)
- **Payment:** x402 via daydreams facilitator
- **Network:** Base
- **Pricing:** 0.05 USDC per request

### Features
- Multi-protocol support (6 major DeFi protocols)
- Multi-chain monitoring (7 chains: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche)
- TVL tracking with USD conversion
- APY calculation (fees + rewards for DEX, supply/borrow rates for lending)
- Configurable alert thresholds
- Historical delta calculation (5min, 15min, 60min)
- Alert severity levels (low, medium, high, critical)
- Data integration: DeFi Llama, CoinGecko, The Graph

### API Endpoints

#### POST /pools/watch
Monitor pools and generate alerts based on threshold rules.

**Input:**
```json
{
  "protocol_ids": ["uniswap-v2", "aave-v3"],
  "pools": [
    {
      "protocol": "uniswap-v2",
      "chain": 1,
      "address": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc"
    }
  ],
  "threshold_rules": {
    "tvl_drain_pct": 20,
    "tvl_spike_pct": 50,
    "apy_spike_pct": 100,
    "apy_drop_pct": 50
  }
}
```

**Output:**
```json
{
  "pool_metrics": [
    {
      "protocol": "uniswap-v2",
      "chain": 1,
      "pool_address": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
      "tvl_usd": "125000000.00",
      "apy": "12.45",
      "volume_24h_usd": "5000000.00",
      "reserve0": "50000000000000000000000",
      "reserve1": "25000000000000",
      "token0": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "token1": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "timestamp": "2025-10-31T20:30:00Z"
    }
  ],
  "deltas": [
    {
      "pool": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
      "tvl_change_5min": "-2.3%",
      "tvl_change_15min": "-5.8%",
      "tvl_change_60min": "-12.4%",
      "apy_change_5min": "+0.5%",
      "apy_change_15min": "+1.2%",
      "apy_change_60min": "+3.8%"
    }
  ],
  "alerts": [
    {
      "pool": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
      "alert_type": "tvl_drain",
      "severity": "medium",
      "message": "TVL dropped 12.4% in last 60 minutes",
      "threshold": "20%",
      "actual": "12.4%",
      "timestamp": "2025-10-31T20:30:00Z"
    }
  ],
  "total_pools": 1,
  "total_alerts": 1
}
```

#### GET /.well-known/agent.json
Returns AP2 metadata (HTTP 200)

#### GET /.well-known/x402
Returns x402 payment metadata (HTTP 402)

#### GET /entrypoints/yield-pool-watcher/invoke
AP2-compatible entrypoint (returns HTTP 402 for x402 discovery)

#### GET /health
Health check with chain status

#### GET /protocols
List supported protocols

### Supported Protocols & Chains

| Protocol | Chains | Pool Types |
|----------|--------|------------|
| Uniswap V2 | All 7 chains | DEX (AMM) |
| Uniswap V3 | Ethereum, Polygon, Arbitrum, Optimism, Base | DEX (Concentrated Liquidity) |
| SushiSwap | All 7 chains | DEX (AMM) |
| Aave V3 | All except BSC | Lending |
| Curve | Ethereum, Polygon, Arbitrum, Optimism | DEX (Stableswap) |
| PancakeSwap | BSC | DEX (AMM) |
| TraderJoe | Avalanche | DEX (AMM) |

### Alert Types

1. **TVL Drain** - TVL drops beyond threshold% in monitoring window
2. **TVL Spike** - TVL increases beyond threshold% in monitoring window
3. **APY Spike** - APY increases beyond threshold%
4. **APY Drop** - APY decreases beyond threshold%

### Metric Calculations

**TVL (Total Value Locked):**
- DEX Pools: `(reserve0 × price0) + (reserve1 × price1)`
- Lending Pools: Query from protocol contracts
- USD conversion via CoinGecko prices

**APY (Annual Percentage Yield):**
- DEX Pools: `(24h_fees / TVL) × 365 × 100`
- Lending Supply: `(supplyRate / 1e27) × SECONDS_PER_YEAR × 100`
- Lending Borrow: `(borrowRate / 1e27) × SECONDS_PER_YEAR × 100`

## Performance

**Real-time Monitoring:**
- Configurable polling intervals
- 1-block detection capability
- Historical snapshots (24h retention)
- Delta calculation windows: 5min, 15min, 60min

**Accuracy:**
- On-chain data from smart contracts
- Token prices from CoinGecko
- Cross-protocol standardization
- Graceful fallback for API failures

**Scalability:**
- Multi-chain concurrent monitoring
- Protocol adapter architecture
- Efficient RPC usage
- In-memory snapshot storage

## Testing

Service is live and registered on x402scan: https://www.x402scan.com

### Test Commands

```bash
# Check health
curl https://yield-pool-watcher-production.up.railway.app/health

# List supported protocols
curl https://yield-pool-watcher-production.up.railway.app/protocols

# Watch Uniswap V2 USDC/WETH pool on Ethereum
curl -X POST https://yield-pool-watcher-production.up.railway.app/pools/watch \
  -H "Content-Type: application/json" \
  -d '{
    "protocol_ids": ["uniswap-v2"],
    "pools": [{
      "protocol": "uniswap-v2",
      "chain": 1,
      "address": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc"
    }],
    "threshold_rules": {
      "tvl_drain_pct": 20,
      "tvl_spike_pct": 50,
      "apy_spike_pct": 100,
      "apy_drop_pct": 50
    }
  }'

# Verify x402 compliance (must return 402)
curl -I https://yield-pool-watcher-production.up.railway.app/.well-known/x402

# Check AP2 metadata (must return 200)
curl https://yield-pool-watcher-production.up.railway.app/.well-known/agent.json

# Check x402 entrypoint (must return 402)
curl -I https://yield-pool-watcher-production.up.railway.app/entrypoints/yield-pool-watcher/invoke
```

## Repository

**GitHub:** https://github.com/DeganAI/yield-pool-watcher

**Key Files:**
- `/src/main.py` - FastAPI application with AP2/x402 endpoints
- `/src/protocol_adapters.py` - Multi-protocol adapters
- `/src/pool_monitor.py` - Pool monitoring orchestrator
- `/src/tvl_tracker.py` - TVL calculation and tracking
- `/src/apy_calculator.py` - APY calculation logic
- `/src/alert_engine.py` - Threshold monitoring and alerts
- `/src/data_sources.py` - External API integrations
- `/Dockerfile` - Container configuration
- `/railway.toml` - Railway deployment config
- `/test_endpoints.sh` - API testing script
- `/README.md` - Complete project documentation
- `/PRODUCTION_SETUP.md` - Deployment guide

## Wallet Information

**Payment Address (ETH/Base):** 0x01D11F7e1a46AbFC6092d7be484895D2d505095c

**Solana Wallet:** Hnf7qnwdHYtSqj7PjjLjokUq4qaHR4qtHLedW7XDaNDG

## Additional Resources

- **Live Service:** https://yield-pool-watcher-production.up.railway.app
- **API Documentation:** https://yield-pool-watcher-production.up.railway.app/docs
- **x402 Registration:** ✅ Registered on x402scan

---

**Submitted by:** DeganAI (Ian B - hashmonkey@degenai.us)

**Date:** October 31, 2025

**Bounty Issue:** https://github.com/daydreamsai/agent-bounties/issues/6
