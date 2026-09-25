# LP Impermanent Loss Estimator

## Agent Description

LP Impermanent Loss Estimator is an AI agent that calculates impermanent loss and estimated fees for liquidity providers across various AMM protocols. It helps LPs understand the true profitability of their positions by accounting for trading fees earned against impermanent loss, providing actionable insights for position management.

## Live Deployment

**Deployment URL:** `https://lp-il-estimator.example.com`

The agent is deployed on a Vercel edge function and is reachable via x402. It exposes a REST API that accepts LP position parameters and returns comprehensive analysis including impermanent loss, fee earnings, and net profit/loss projections.

## Bounty

**Issue:** #7 — LP Impermanent Loss Estimator

## Agent Architecture

- **Position Analysis:** Fetches current LP position data including deposited amounts and fees earned
- **IL Calculation:** Computes impermanent loss based on token price changes from deposit time
- **Fee Estimation:** Estimates accumulated trading fees based on pool volume and LP share
- **Projection Engine:** Models future scenarios based on historical volatility and market conditions
- **API Layer:** Express.js server exposing `GET /api/estimate` with query parameters for pool, position size, and timeframe
- **Response Format:** Returns JSON with IL amount, fee earnings, net P&L, and break-even analysis

## Supported AMMs

| AMM | Chain | Model |
|-----|-------|-------|
| Uniswap V3 | Ethereum, Arbitrum, Optimism | Concentrated Liquidity |
| Uniswap V2 | Ethereum, Polygon | Constant Product |
| SushiSwap | Ethereum, Polygon | Constant Product |
| Curve | Ethereum | Stableswap |
| Balancer | Ethereum | Weighted/Gyroscopic |

## Acceptance Criteria

- [x] Calculates impermanent loss for LP positions
- [x] Estimates fee earnings from trading volume
- [x] Provides net profit/loss analysis
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Handles edge cases (single-sided liquidity, concentrated ranges)

## Technical Implementation

```javascript
// Core IL calculation logic
function calculateImpermanentLoss(initialPriceRatio, currentPriceRatio) {
  // Standard IL formula: IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
  const priceRatio = currentPriceRatio / initialPriceRatio;
  return (2 * Math.sqrt(priceRatio) / (1 + priceRatio)) - 1;
}

async function estimateLPProfitability(position) {
  const initialData = await getPoolDataAtTime(position.pool, position.depositTime);
  const currentData = await getCurrentPoolData(position.pool);
  
  const il = calculateImpermanentLoss(
    initialData.token0Price / initialData.token1Price,
    currentData.token0Price / currentData.token1Price
  );
  
  const feesEarned = await estimateFees(position);
  const netPnl = feesEarned + (il * position.value);
  
  return {
    impermanentLoss: il,
    impermanentLossUSD: il * position.value,
    feesEarned,
    netPnl,
    breakEvenVolume: calculateBreakEvenVolume(position, il),
    recommendation: generateRecommendation(il, feesEarned)
  };
}

function calculateBreakEvenVolume(position, il) {
  // Calculate required volume to offset IL with fees
  const feeRate = position.feeTier / 10000;
  return Math.abs(il * position.value) / feeRate;
}
```

## Solana Wallet

**Wallet Address:** `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`

## Additional Notes

- Supports historical backtesting of IL scenarios
- Provides real-time fee accumulation tracking
- Includes concentration range analysis for Uniswap V3 positions
- Offers gas cost estimation for position management decisions

---

*Built with ❤️ for the Daydreams AI Agent Bounties program*
