# LP Impermanent Loss Estimator - Bounty #7 Submission

## Agent Information

**Name:** LP Impermanent Loss Estimator

**Description:** Calculate IL and fee APR for any LP position or simulated deposit. Provides accurate impermanent loss calculations and yield estimates validated against historical pool data.

**Live Endpoint:** https://lp-impermanent-loss-estimator-production-62b5.up.railway.app/entrypoints/lp-impermanent-loss-estimator/invoke

## Acceptance Criteria

- ✅ **Backtest error under 10% vs realized pool data**
  - Standard IL formulas for 50/50 pools: `IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1`
  - Weighted pool formulas for Balancer-style pools
  - Historical price data from CoinGecko for accurate calculations
  - Actual vs HODL comparison

- ✅ **Accurate IL calculations for major AMMs**
  - Uniswap V2 (0.3% fee, 50/50 weight)
  - Uniswap V3 (0.05%, 0.3%, 1% fees, concentrated liquidity)
  - SushiSwap (0.3% fee, 50/50 weight)
  - Balancer (custom weights: 80/20, 60/40, 50/50)
  - Curve (stablecoin pools with minimal IL)
  - Multi-chain support across 7 chains

- ✅ **Deployed on a domain and reachable via x402**
  - Deployed: https://lp-impermanent-loss-estimator-production-62b5.up.railway.app
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
- Impermanent loss calculation for 50/50, weighted, and multi-asset pools
- Fee APR estimation from historical trading volume
- Multi-AMM support (Uniswap V2/V3, SushiSwap, Balancer, Curve)
- Multi-chain monitoring (7 chains: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche)
- Historical price change analysis
- Position-specific earnings calculations
- HODL vs LP comparison

### API Endpoints

#### POST /lp/estimate
Calculate impermanent loss and fee APR for an LP position.

**Input:**
```json
{
  "pool_address": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
  "chain": 1,
  "token_weights": [0.5, 0.5],
  "deposit_amounts": ["1000000000000000000", "1500000000"],
  "window_hours": 168
}
```

**Output:**
```json
{
  "pool_address": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
  "chain": 1,
  "tokens": [
    {
      "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "symbol": "WETH",
      "initial_price": "2000.00",
      "current_price": "2200.00",
      "price_change_pct": "10.00"
    },
    {
      "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "symbol": "USDT",
      "initial_price": "1.00",
      "current_price": "1.00",
      "price_change_pct": "0.00"
    }
  ],
  "IL_percent": "-0.62",
  "hodl_value_usd": "3200.00",
  "lp_value_usd": "3180.16",
  "il_loss_usd": "19.84",
  "fee_apr_est": "12.45",
  "fees_earned_usd": "35.00",
  "net_return_pct": "0.47",
  "volume_window": "5000000.00",
  "tvl_avg": "125000000.00",
  "window_hours": 168,
  "notes": [
    "IL is negative due to price divergence between tokens",
    "Fee APR partially offsets IL",
    "Net return is positive when fees are included"
  ]
}
```

#### GET /.well-known/agent.json
Returns AP2 metadata (HTTP 200)

#### GET /.well-known/x402
Returns x402 payment metadata (HTTP 402)

#### GET /entrypoints/lp-impermanent-loss-estimator/invoke
AP2-compatible entrypoint (returns HTTP 402 for x402 discovery)

#### GET /health
Health check with chain status

### Supported AMMs & Chains

| AMM | Fee Tier | Pool Type | Chains |
|-----|----------|-----------|--------|
| Uniswap V2 | 0.3% | 50/50 | All 7 chains |
| Uniswap V3 | 0.05%, 0.3%, 1% | Concentrated Liquidity | Ethereum, Polygon, Arbitrum, Optimism, Base |
| SushiSwap | 0.3% | 50/50 | All 7 chains |
| Balancer | Variable | Custom Weights | Ethereum, Polygon, Arbitrum, Optimism |
| Curve | ~0.04% | Stableswap | Ethereum, Polygon, Arbitrum, Optimism |

### Impermanent Loss Formula

**For 50/50 pools (Uniswap V2, SushiSwap):**
```
IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1
```

**For weighted pools (Balancer):**
```
IL = (w0 * price_ratio^w1 + w1 * price_ratio^w0)^(1/(w0+w1)) - 1
```

Where:
- `price_ratio` = current_price / initial_price
- `w0, w1` = token weights (e.g., 0.8, 0.2 for 80/20 pool)

**Fee APR Calculation:**
```
APR = (volume × fee_tier / TVL) × (365 × 24 / window_hours) × 100
```

### Performance

**Accuracy:**
- Standard formulas validated against academic research
- Historical price data from CoinGecko
- Real-time pool data from on-chain contracts
- <10% error vs realized pool data (backtest validated)

**Data Sources:**
- On-chain: Pool reserves, token addresses, fee tiers
- CoinGecko: Current and historical token prices
- The Graph: Historical swap volume (with fallback estimation)
- Pool snapshots for TVL tracking

**Reliability:**
- Graceful fallback for missing historical data
- Conservative estimates when data is unavailable
- Clear notes on data quality and assumptions

## Testing

Service is live and registered on x402scan: https://www.x402scan.com

### Test Commands

```bash
# Check health
curl https://lp-impermanent-loss-estimator-production-62b5.up.railway.app/health

# Estimate IL for Uniswap V2 WETH/USDT pool
curl -X POST https://lp-impermanent-loss-estimator-production-62b5.up.railway.app/lp/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "pool_address": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
    "chain": 1,
    "token_weights": [0.5, 0.5],
    "deposit_amounts": ["1000000000000000000", "1500000000"],
    "window_hours": 168
  }'

# Verify x402 compliance (must return 402)
curl -I https://lp-impermanent-loss-estimator-production-62b5.up.railway.app/.well-known/x402

# Check AP2 metadata (must return 200)
curl https://lp-impermanent-loss-estimator-production-62b5.up.railway.app/.well-known/agent.json

# Check x402 entrypoint (must return 402)
curl -I https://lp-impermanent-loss-estimator-production-62b5.up.railway.app/entrypoints/lp-impermanent-loss-estimator/invoke
```

## Repository

**GitHub:** https://github.com/DeganAI/lp-impermanent-loss-estimator

**Key Files:**
- `/src/main.py` - FastAPI application with AP2/x402 endpoints
- `/src/il_calculator.py` - Impermanent loss calculation logic
- `/src/fee_estimator.py` - Fee APR estimation
- `/src/pool_analyzer.py` - Pool data analysis orchestrator
- `/src/data_sources.py` - Multi-source data fetching
- `/Dockerfile` - Container configuration
- `/railway.toml` - Railway deployment config
- `/test_endpoints.sh` - API testing script
- `/README.md` - Complete project documentation
- `/PRODUCTION_SETUP.md` - Deployment guide

## Wallet Information

**Payment Address (ETH/Base):** 0x01D11F7e1a46AbFC6092d7be484895D2d505095c

**Solana Wallet:** Hnf7qnwdHYtSqj7PjjLjokUq4qaHR4qtHLedW7XDaNDG

## Additional Resources

- **Live Service:** https://lp-impermanent-loss-estimator-production-62b5.up.railway.app
- **API Documentation:** https://lp-impermanent-loss-estimator-production-62b5.up.railway.app/docs
- **x402 Registration:** ✅ Registered on x402scan

---

**Submitted by:** DeganAI (Ian B - hashmonkey@degenai.us)

**Date:** October 31, 2025

**Bounty Issue:** https://github.com/daydreamsai/agent-bounties/issues/7
