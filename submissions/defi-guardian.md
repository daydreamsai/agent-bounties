# DeFi Guardian - Comprehensive Portfolio Health Monitoring

## Agent Description

**DeFi Guardian** is a comprehensive DeFi portfolio health monitoring agent that combines multiple specialized analysis capabilities into a single x402-powered service. It provides AI agents and users with real-time risk assessment, position monitoring, and actionable insights across lending, yield farming, and liquidity provision.

### Key Features

- **Auto-Detect LP Positions:** Scans Uniswap V3, Curve, Balancer, and SushiSwap for active positions
- **Lending Risk Monitoring:** Real-time liquidation risk assessment across major lending protocols
- **Impermanent Loss Analysis:** Calculates IL percentage and net APR for LP positions
- **Yield Opportunity Tracking:** Monitors high-yield farming opportunities with TVL/APY thresholds
- **Optional Perps Analysis:** Perpetuals funding rate monitoring (OKX, Hyperliquid)
- **Optional Arbitrage Detection:** Cross-DEX arbitrage opportunity scanning
- **Comprehensive Risk Scoring:** Overall portfolio health score (0-100) with critical alerts

### Technical Stack

- **Runtime:** Bun
- **Framework:** Hono with @lucid-dreams/agent-kit v0.2.24
- **Payment:** x402 protocol with USDC on Base ($0.75 flat rate)
- **Validation:** TypeScript + Zod schemas
- **Deployment:** Railway (auto-scaling)
- **Architecture:** Orchestrates 6 internal microservices

---

## Live Link

**Deployment URL:** https://defi-guardian-production.up.railway.app

**Manifest:** https://defi-guardian-production.up.railway.app/.well-known/agent.json

### Verification

```bash
# Test the invoke endpoint (requires x402 payment)
curl -i https://defi-guardian-production.up.railway.app/entrypoints/defi-guardian/invoke

# View agent manifest
curl https://defi-guardian-production.up.railway.app/.well-known/agent.json

# Check health/info
curl https://defi-guardian-production.up.railway.app/
```

Returns HTTP 402 (Payment Required) with proper x402 headers showing $0.75 USDC pricing.

---

## Acceptance Criteria

**Bounties Addressed:**

This agent satisfies requirements for multiple bounties through its comprehensive approach:

- **Bounty #6: Yield Pool Watcher** ✅
  - [x] Monitors APY across Aave V3, Compound V3, Uniswap V3
  - [x] Tracks TVL changes
  - [x] Configurable APY and TVL thresholds
  - [x] Returns pool data with alerts

- **Bounty #7: LP Impermanent Loss Estimator** ✅
  - [x] Calculates IL percentage for LP positions
  - [x] Estimates fees earned
  - [x] Computes net APR (fees - IL)
  - [x] Provides actionable recommendations

- **Bounty #9: Lending Liquidation Sentinel** ✅
  - [x] Monitors health factors across lending protocols
  - [x] Identifies at-risk positions (health factor < 1.2)
  - [x] Real-time liquidation risk assessment
  - [x] Critical alerts for dangerous positions

**General Requirements:**

- [x] Deployed on a domain (Railway)
- [x] Reachable via x402 protocol
- [x] Complete agent manifest at /.well-known/agent.json
- [x] Working payment integration ($0.75 USDC on Base)
- [x] Custom landing page with API documentation
- [x] Proper Open Graph meta tags for discoverability

---

## Input Schema

```typescript
{
  wallet_address: string,           // Required: Wallet to analyze
  chain_ids?: number[],             // Optional: [1, 42161, 8453] default
  include_perps?: boolean,          // Optional: false default
  include_arbitrage?: boolean,      // Optional: false default
  lp_positions?: Array<{            // Optional: Manual LP position data
    protocol: string,
    token0_symbol: string,
    token1_symbol: string,
    token0_amount: number,
    token1_amount: number,
    initial_price0: number,
    initial_price1: number,
    entry_date: string
  }>
}
```

## Output Schema

```typescript
{
  wallet_address: string,
  overall_risk_score: number,        // 0-100 (0=safe, 100=critical)
  total_positions: number,
  critical_alerts: string[],
  lending_analysis: {
    positions: any[],
    at_risk_count: number
  } | null,
  yield_analysis: {
    pools: any[],
    alerts_count: number
  } | null,
  lp_analysis: {
    il_percentage: number,
    net_apr: number,
    recommendation: string
  } | null,
  perps_analysis?: {
    positions: any[]
  } | null,
  arbitrage_opportunities?: {
    opportunities: any[]
  } | null,
  summary: string,
  timestamp: string
}
```

---

## Architecture

DeFi Guardian operates as an **orchestrator agent** that coordinates 6 specialized internal microservices:

1. **Portfolio Scanner** - Detects LP positions across DEXs
2. **Lending Liquidation Sentinel** - Monitors lending health factors
3. **Yield Pool Watcher** - Tracks APY/TVL across protocols
4. **LP Impermanent Loss Estimator** - Calculates IL and net returns
5. **Perps Funding Pulse** (optional) - Perpetuals funding rates
6. **Cross DEX Arbitrage** (optional) - Multi-DEX arbitrage detection

---

## Competitive Advantages

| Feature | DeFi Guardian | Individual Services |
|---------|---------------|---------------------|
| Coverage | 6 services in 1 | Separate calls needed |
| Risk Score | Holistic 0-100 | Manual aggregation |
| Auto-Detection | Full portfolio scan | Manual position entry |
| Critical Alerts | Consolidated | Scattered across tools |

---

## Other Resources

- **Repository:** Private (production deployment)
- **Payment Address:** 0x01D11F7e1a46AbFC6092d7be484895D2d505095c
- **Organization:** DegenLlama.net
- **x402 Protocol:** v1 with facilitator at https://facilitator.daydreams.systems

### Supported Protocols

**Lending:** Aave V3, Compound V3
**DEXs:** Uniswap V3, Curve, Balancer, SushiSwap
**Perps:** OKX, Hyperliquid (optional)
**Chains:** Ethereum, Arbitrum, Base (configurable)

---

## Solana Wallet

**Wallet Address:** `Hnf7qnwdHYtSqj7PjjLjokUq4qaHR4qtHLedW7XDaNDG`

---

## Why This Matters

### Problem Solved

DeFi users and AI agents need comprehensive portfolio monitoring but face:
- Fragmented tools requiring multiple API calls
- Manual position entry and risk calculation
- No unified risk scoring
- Scattered data across multiple services

### Solution

DeFi Guardian provides:
1. **One-Call Analysis:** Complete portfolio health in single request
2. **Auto-Detection:** Scans wallet for LP positions automatically
3. **Holistic Risk Score:** 0-100 scoring with critical alerts
4. **Actionable Insights:** Clear recommendations and warnings
5. **Comprehensive Coverage:** 6 specialized analyses in one agent

### Use Cases

- **AI Trading Agents:** Assess portfolio risk before executing strategies
- **DeFi Dashboards:** Real-time health monitoring for users
- **Risk Management:** Automated liquidation warnings
- **Yield Optimization:** Identify underperforming positions
- **Portfolio Rebalancing:** Data-driven position adjustments

---

## Impact Metrics

- **6 Services Integrated:** Lending, Yield, LP, Perps, Arbitrage, Portfolio Scanner
- **3 Bounties Addressed:** #6 (Yield), #7 (IL Estimator), #9 (Lending)
- **Multi-Chain Support:** Ethereum, Arbitrum, Base
- **10+ Protocols Covered:** Major DeFi protocols across categories
- **Comprehensive Analysis:** Single endpoint for complete portfolio health

---

**Built by [DegenLlama.net](https://degenllama.net)**

Thank you for considering DeFi Guardian as a comprehensive solution for the x402 DeFi ecosystem!
