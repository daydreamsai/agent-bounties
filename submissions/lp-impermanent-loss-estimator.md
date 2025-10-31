# LP Impermanent Loss Estimator

## Overview
An AI agent that calculates impermanent loss and fee APR for liquidity provider positions using real historical price data from CoinGecko. Helps LPs understand if their positions are profitable by comparing hodling vs providing liquidity.

## Agent Details

**Agent Name:** LP Impermanent Loss Estimator  
**Live Deployment:** https://lp-impermanent-loss-estimator-production.up.railway.app  
**Source Code:** https://github.com/natefrog808/LP-Impermanent-Loss-Estimator  
**Related Bounty:** [Issue #7 - Build an Agent](https://github.com/daydreamsai/agent-bounties/issues/7)  
**Solana Wallet Address:** `4K7a18QwGBJ6DqesMbvc5iovQWPsvBhopmBqqb6rRVHq`  
**Payment Address (x402):** `0xe7A413d4192fdee1bB5ecdf9D07A1827Eb15Bc1F`

## Description

This agent provides comprehensive impermanent loss analysis for liquidity providers by:

- **Real Historical Data:** Fetches actual token prices from CoinGecko API for accurate calculations
- **IL Calculation:** Uses the constant product AMM formula (x × y = k) to calculate precise impermanent loss
- **Fee APR Estimation:** Models fee earnings based on pool type (volatile ~30% APR, stable ~3% APR)
- **Net P&L Analysis:** Combines IL and fee earnings to show total profitability
- **Actionable Insights:** Provides recommendations based on position health

## Key Features

✅ **Accurate IL Calculations** - Uses proven constant product formula  
✅ **Historical Price Data** - Real data from CoinGecko, not estimates  
✅ **Multi-Token Support** - ETH, BTC, USDC, USDT, DAI  
✅ **Fee APR Modeling** - Intelligent estimates based on pool characteristics  
✅ **x402 Integration** - $0.10 USDC per calculation via x402 protocol  
✅ **Agent Discovery** - Standard entrypoints and .well-known endpoints  
✅ **Production Ready** - Deployed on Railway with health checks  

## Technical Implementation

**Framework:** [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit) v0.2.22  
**Runtime:** Node.js v20 with TypeScript (tsx)  
**Deployment:** Railway  
**Payment Protocol:** x402 on Base network  
**Data Source:** CoinGecko API  

## Endpoints

### Discovery
- `GET /entrypoints` - List available agent functions
- `GET /.well-known/agent.json` - Agent metadata
- `GET /health` - Health check

### Main Function
- `POST /entrypoints/calculate-il` - Calculate impermanent loss and fees

## Quick Test

```bash
# Health check
curl https://lp-impermanent-loss-estimator-production.up.railway.app/health

# Calculate IL for ETH/USDC position
curl -X POST https://lp-impermanent-loss-estimator-production.up.railway.app/entrypoints/calculate-il \
  -H "Content-Type: application/json" \
  -d '{
    "token0Symbol": "ETH",
    "token1Symbol": "USDC",
    "token0Amount": 1.5,
    "token1Amount": 3000,
    "daysHeld": 30
  }'
```

**Example Response:**
```json
{
  "token0Symbol": "ETH",
  "token1Symbol": "USDC",
  "initialValue": 5025.50,
  "currentValue": 5150.25,
  "hodlValue": 5200.00,
  "impermanentLoss": -49.75,
  "impermanentLossPercent": -0.96,
  "estimatedFeeAPR": 30.0,
  "estimatedFeesEarned": 123.50,
  "netProfitLoss": 73.75,
  "netProfitLossPercent": 1.47,
  "recommendation": "✅ Fees are covering IL well. Position looks healthy.",
  "priceChange": {
    "token0": 5.2,
    "token1": 0.1,
    "ratio": 5.1
  }
}
```

## Use Cases

1. **Position Analysis** - Is my LP position actually profitable?
2. **Strategy Comparison** - Should I LP or just HODL?
3. **Risk Assessment** - How much IL am I experiencing?
4. **Performance Tracking** - Monitor multiple positions over time
5. **Portfolio Optimization** - Which pools are worth the IL risk?

## How It Works

1. **Fetch Historical Prices:** Queries CoinGecko for token prices from X days ago
2. **Calculate Current Value:** Uses constant product formula to determine current pool value
3. **Compare to HODL:** Calculates what the position would be worth if held outside the pool
4. **Estimate Fees:** Models fee earnings based on pool type and TVL patterns
5. **Net Analysis:** Combines IL and fees to show true profitability
6. **Recommendations:** Provides actionable guidance based on the data

## Formula

```
Impermanent Loss = Current Pool Value - HODL Value

where:
  Current Pool Value = 2 × √(k × P_ratio) × P_token1
  k = token0_amount × token1_amount (constant product)
  P_ratio = current_price_ratio / entry_price_ratio
```

## Acceptance Criteria Met

✅ **Built with agent-kit** - Uses @lucid-dreams/agent-kit v0.2.22  
✅ **x402 enabled** - Accepts payments via x402 protocol  
✅ **Deployed and reachable** - Live on Railway with public endpoint  
✅ **Functional and tested** - All endpoints working and returning valid data  
✅ **Discovery endpoints** - Implements /entrypoints and /.well-known/agent.json  
✅ **Documentation** - Comprehensive README with usage examples  

## Additional Resources

- **Live Agent:** https://lp-impermanent-loss-estimator-production.up.railway.app
- **Source Code:** https://github.com/natefrog808/LP-Impermanent-Loss-Estimator
- **Agent Kit Docs:** https://www.npmjs.com/package/@lucid-dreams/agent-kit
- **x402 Protocol:** https://x402.org

## Deployment Details

**Platform:** Railway  
**Region:** US-West  
**Health Check:** `/health` endpoint with 5-minute timeout  
**Uptime:** 99.9% target  
**Response Time:** < 2s for calculations  

## Payment Configuration

**Network:** Base (Ethereum L2)  
**Price:** $0.10 USDC per calculation  
**Payment Address:** `0xe7A413d4192fdee1bB5ecdf9D07A1827Eb15Bc1F`  
**Facilitator:** x402 standard facilitator  

## Future Enhancements

- Support for more DEXs (Uniswap V3, Curve, Balancer)
- Historical IL tracking and charts
- Multi-position portfolio analysis
- Alert system for high IL scenarios
- Integration with on-chain position data

---

**Submitted by:** natefrog808 (DeganAI)  
**Date:** October 31, 2025  
**GitHub:** https://github.com/natefrog808  
**Solana Wallet:** 4K7a18QwGBJ6DqesMbvc5iovQWPsvBhopmBqqb6rRVHq
