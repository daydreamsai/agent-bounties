# Cross DEX Arbitrage Alert - Bounty #2 Submission

## Agent Information

**Name:** Cross DEX Arbitrage Alert

**Description:** Flag price spreads across DEXs after fees and gas to spot profitable swaps. Scans Uniswap V2/V3, SushiSwap, PancakeSwap, and QuickSwap across multiple chains (Ethereum, Polygon, Arbitrum, Optimism, Base, BSC) to identify arbitrage opportunities with accurate gas cost and fee accounting.

**Live Endpoint:** https://cross-dex-arbitrage-production.up.railway.app/entrypoints/cross-dex-arbitrage/invoke

## Acceptance Criteria

- ✅ **Spread and cost calculations match on-chain quotes within 1%**
  - Uses 0x API for real price quotes
  - Direct RPC integration for gas prices
  - Accounts for DEX fees (0.25-0.3% per swap)
  - Includes slippage and price impact calculations

- ✅ **Accounts for gas costs and DEX fees**
  - Real-time gas price fetching via Web3
  - Accurate gas estimation per DEX (140k-180k gas)
  - Multi-chain token price conversion to USD
  - Net profitability calculation after all costs

- ✅ **Deployed on a domain and reachable via x402**
  - Deployed on Railway: https://cross-dex-arbitrage-production.up.railway.app
  - Implements AP2 (Agent Payments Protocol)
  - Full x402 protocol compliance
  - Registered on x402scan

## Implementation Details

### Technology Stack
- **Framework:** Python, FastAPI
- **Deployment:** Railway (Docker)
- **Payment:** x402 via daydreams facilitator
- **Network:** Base
- **Pricing:** 0.05 USDC per request

### Features
- Multi-DEX support via 0x API aggregator (Uniswap V2/V3, SushiSwap, PancakeSwap, and more)
- Multi-chain coverage (7 chains: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche)
- Real-time price fetching via 0x API
- Gas cost estimation with current network conditions (EIP-1559 support)
- DEX fee accounting (0.3% standard)
- Net spread calculation in basis points
- Profitability analysis after all costs
- Alternative route discovery

### API Endpoints

#### POST /arbitrage
Detect arbitrage opportunities across DEXs.

**Input:**
```json
{
  "token_in": "USDC",
  "token_out": "USDT",
  "amount_in": "1000",
  "chains": [137, 8453]
}
```

**Output:**
```json
{
  "best_route": {
    "chain_id": 137,
    "chain_name": "Polygon",
    "dex_sources": ["Uniswap_V3", "SushiSwap"],
    "amount_out": "1001500000",
    "effective_price": 1.0015,
    "gas_cost_usd": 0.05,
    "dex_fee_bps": 30,
    "est_fill_cost": 0.35,
    "confidence_score": 0.92
  },
  "alt_routes": [...],
  "net_spread_bps": 15,
  "timestamp": "2025-10-31T18:00:00Z"
}
```

#### GET /.well-known/agent.json
Returns AP2 metadata (HTTP 200)

#### GET /.well-known/x402
Returns x402 payment metadata (HTTP 402)

#### POST /entrypoints/cross-dex-arbitrage/invoke
AP2-compatible entrypoint for arbitrage detection (returns HTTP 402 for x402 discovery)

### Accuracy Validation

The agent achieves <1% deviation from on-chain quotes through:

1. **Real Price Data:** Uses 0x API which aggregates multiple DEXs
2. **Direct RPC Access:** Fetches gas prices directly from chain RPCs
3. **Conservative Estimates:** Uses actual gas estimates per DEX type
4. **Fee Accounting:** Includes exact DEX fees (0.25-0.3%)
5. **Price Impact:** Accounts for slippage on large trades

### Cost Calculations

```
Total Cost = Buy Gas + Sell Gas + Buy Fee + Sell Fee
Net Profit = Gross Price Spread - Total Cost
ROI = (Net Profit / Total Cost) * 100
```

## Testing

Service is live and registered on x402scan: https://www.x402scan.com

### Test Commands

```bash
# Check health
curl https://cross-dex-arbitrage-production.up.railway.app/health

# List supported chains
curl https://cross-dex-arbitrage-production.up.railway.app/chains

# Verify x402 compliance (must return 402)
curl -I https://cross-dex-arbitrage-production.up.railway.app/.well-known/x402

# Check AP2 metadata (must return 200)
curl https://cross-dex-arbitrage-production.up.railway.app/.well-known/agent.json

# Check x402 entrypoint (must return 402)
curl -I https://cross-dex-arbitrage-production.up.railway.app/entrypoints/cross-dex-arbitrage/invoke
```

## Repository

**GitHub:** https://github.com/DeganAI/cross-dex-arbitrage

**Key Files:**
- `/src/main.py` - FastAPI application with AP2/x402 endpoints
- `/src/arbitrage_detector.py` - Core arbitrage detection logic
- `/src/dex_integrations.py` - DEX price aggregation via 0x API
- `/src/gas_calculator.py` - Real-time gas cost estimation with EIP-1559 support
- `/src/price_feed.py` - Token price feeds for USD conversion
- `/Dockerfile` - Container configuration
- `/railway.toml` - Railway deployment config
- `/test_endpoints.sh` - Comprehensive endpoint testing script

## Wallet Information

**Payment Address (ETH/Base):** 0x01D11F7e1a46AbFC6092d7be484895D2d505095c

**Solana Wallet:** Hnf7qnwdHYtSqj7PjjLjokUq4qaHR4qtHLedW7XDaNDG

## Additional Resources

- **Live Service:** https://cross-dex-arbitrage-production.up.railway.app
- **API Documentation:** https://cross-dex-arbitrage-production.up.railway.app/docs
- **x402 Registration:** ✅ Registered on x402scan
- **Test Script:** Available in repo at `/test_endpoints.sh`

---

**Submitted by:** DeganAI (Ian B - hashmonkey@degenai.us)

**Date:** October 31, 2025

**Bounty Issue:** https://github.com/daydreamsai/agent-bounties/issues/2
