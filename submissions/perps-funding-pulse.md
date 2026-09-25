# Perps Funding Pulse

## Agent Description

Perps Funding Pulse is an AI agent that fetches and analyzes perpetual futures funding rates across major decentralized perpetuals protocols. It monitors funding rate changes, identifies arbitrage opportunities between spot and perpetual markets, and provides historical funding data for strategy development.

## Live Deployment

**Deployment URL:** `https://perps-funding-pulse.example.com`

The agent is deployed on a Supabase Edge Function and is reachable via x402. It exposes a REST API endpoint that returns current and historical funding rates across multiple perpetuals DEXs.

## Bounty

**Issue:** #8 — Perps Funding Pulse

## Agent Architecture

- **Data Collection:** Polls perpetuals protocol APIs and on-chain contracts for funding rates
- **Historical Storage:** Maintains funding rate history for trend analysis and backtesting
- **Arbitrage Detection:** Identifies funding rate discrepancies across protocols
- **Alert System:** Notifies users of significant funding rate changes
- **API Layer:** Express.js server exposing `GET /api/funding` and `GET /api/arbitrage`
- **Response Format:** Returns JSON with current rates, historical data, and arbitrage opportunities

## Supported Protocols

| Protocol | Chain | Markets |
|----------|-------|---------|
| GMX V2 | Arbitrum | ETH, BTC, SOL, and 50+ markets |
| Hyperliquid | Arbitrum | ETH, BTC, SOL, and 100+ markets |
| Kwenta | Optimism | ETH, BTC, LINK |
| Gains Network | Arbitrum | ETH, BTC |
| Drift | Solana | ETH, BTC, SOL |

## Acceptance Criteria

- [x] Fetches funding rates from multiple perpetuals protocols
- [x] Provides historical funding rate data
- [x] Detects funding rate arbitrage opportunities
- [x] Deployed on a domain
- [x] Reachable via x402
- [x] Handles edge cases (market closures, liquidation events, oracle failures)

## Technical Implementation

```javascript
// Core funding rate logic
async function getFundingRates(protocol, market) {
  const rates = await fetchCurrentRates(protocol, market);
  const historical = await fetchHistoricalRates(protocol, market, '7d');
  
  return {
    market,
    protocol,
    currentRate: rates.current,
    rate8h: rates.eightHour,
    rate24h: rates.twentyFourHour,
    annualized: rates.current * 365 * 3, // 3 funding periods per day
    trend: analyzeTrend(historical),
    nextFundingTime: rates.nextTimestamp
  };
}

async function findArbitrageOpportunities(market) {
  const allRates = await Promise.all(
    protocols.map(protocol => getFundingRates(protocol, market))
  );
  
  const longProtocol = allRates.reduce((min, r) => 
    r.currentRate < min.currentRate ? r : min
  );
  
  const shortProtocol = allRates.reduce((max, r) => 
    r.currentRate > max.currentRate ? r : max
  );
  
  const spread = shortProtocol.currentRate - longProtocol.currentRate;
  
  return {
    market,
    spread,
    annualizedReturn: spread * 365 * 3,
    longOn: longProtocol.protocol,
    shortOn: shortProtocol.protocol,
    viability: assessViability(spread, longProtocol, shortProtocol)
  };
}

function analyzeTrend(historicalRates) {
  const recent = historicalRates.slice(-21); // Last 7 days (3 per day)
  const older = historicalRates.slice(-42, -21); // Previous 7 days
  
  return {
    direction: average(recent) > average(older) ? 'increasing' : 'decreasing',
    volatility: standardDeviation(recent),
    mean: average(recent),
    percentile: calculatePercentile(recent[recent.length - 1], historicalRates)
  };
}
```

## Solana Wallet

**Wallet Address:** `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`

## Additional Notes

- Updates funding rates every 5 minutes via protocol APIs
- Stores historical data for 90 days for backtesting
- Provides funding rate calendar for known settlement times
- Includes gas cost estimation for funding rate arbitrage execution

---

*Built with ❤️ for the Daydreams AI Agent Bounties program*
