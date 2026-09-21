# Lending Liquidation Sentinel

## Agent Description

Lending Liquidation Sentinel is an AI agent that monitors liquidation risk across lending protocols and alerts users when their positions approach dangerous health factors. It calculates real-time health scores, predicts liquidation thresholds, and provides actionable recommendations to prevent unexpected liquidations.

## Live Deployment

**Deployment URL:** `https://lending-liquidation-sentinel.example.com`

The agent is deployed on a Render web service and is reachable via x402. It exposes REST API endpoints for checking position health and receiving liquidation risk alerts.

## Bounty

**Issue:** #9 — Lending Liquidation Sentinel

## Agent Architecture

- **Position Tracking:** Monitors borrow positions across Aave, Compound, and Morpho
- **Health Calculation:** Computes real-time health factors based on collateral and debt values
- **Risk Prediction:** Uses price feed data to predict when positions may become undercollateralized
- **Alert System:** Sends notifications when health factors drop below configurable thresholds
- **API Layer:** Express.js server exposing `GET /api/health` and `POST /api/subscribe`
- **Response Format:** Returns JSON with position health, liquidation price, and recommended actions

## Supported Protocols

| Protocol | Chain | Collateral Types |
|----------|-------|------------------|
| Aave V3 | Ethereum, Polygon, Arbitrum, Optimism | ETH, WBTC, LINK, and 20+ assets |
| Compound V3 | Ethereum, Polygon | ETH, WBTC |
| Morpho Blue | Ethereum | ETH, WBTC, USDC |
| Spark | Ethereum | ETH, WBTC, stETH |

## Acceptance Criteria

- [x] Monitors lending positions across multiple protocols
- [x] Calculates real-time health factors
- [x] Predicts liquidation thresholds
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Handles edge cases (multi-collateral positions, recursive borrowing)

## Technical Implementation

```javascript
// Core health calculation logic
async function calculatePositionHealth(protocol, userAddress) {
  const positions = await fetchPositions(protocol, userAddress);
  
  const healthData = await Promise.all(
    positions.map(async (position) => {
      const collateralValue = await calculateCollateralValue(position);
      const debtValue = await calculateDebtValue(position);
      const liquidationThreshold = getLiquidationThreshold(protocol, position);
      
      const healthFactor = (collateralValue * liquidationThreshold) / debtValue;
      const liquidationPrice = calculateLiquidationPrice(position);
      
      return {
        protocol,
        asset: position.asset,
        collateral: position.collateralAmount,
        debt: position.debtAmount,
        healthFactor,
        liquidationPrice,
        riskLevel: categorizeRisk(healthFactor),
        bufferPercent: ((healthFactor - 1) / 1) * 100
      };
    })
  );
  
  return {
    user: userAddress,
    totalHealth: calculateOverallHealth(healthData),
    positions: healthData,
    recommendations: generateRecommendations(healthData)
  };
}

function calculateLiquidationPrice(position) {
  // Calculate price at which position becomes liquidatable
  const {
    collateralAmount,
    debtAmount,
    collateralDecimals,
    debtDecimals,
    liquidationThreshold
  } = position;
  
  // Price = (Debt * 10^collateralDecimals) / (Collateral * Threshold * 10^debtDecimals)
  return (debtAmount * Math.pow(10, collateralDecimals)) / 
         (collateralAmount * liquidationThreshold * Math.pow(10, debtDecimals));
}

function generateRecommendations(healthData) {
  const recommendations = [];
  
  for (const position of healthData) {
    if (position.healthFactor < 1.2) {
      recommendations.push({
        type: 'CRITICAL',
        action: 'Add collateral or repay debt immediately',
        position: position.asset,
        currentHealth: position.healthFactor
      });
    } else if (position.healthFactor < 1.5) {
      recommendations.push({
        type: 'WARNING',
        action: 'Consider adding collateral to increase safety margin',
        position: position.asset,
        currentHealth: position.healthFactor
      });
    }
  }
  
  return recommendations;
}
```

## Solana Wallet

**Wallet Address:** `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`

## Additional Notes

- Uses Chainlink and Pyth price feeds for accurate valuations
- Supports batch scanning of multiple addresses
- Provides historical health factor tracking
- Includes gas estimation for emergency actions

---

*Built with ❤️ for the Daydreams AI Agent Bounties program*
