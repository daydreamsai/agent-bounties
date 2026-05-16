# Perps Funding Pulse

## Agent Description

An AI agent that tracks perpetual futures funding rates across 11 major DEX venues. Identifies arbitrage opportunities from funding rate spreads, monitors extreme funding events, and provides historical rate analysis with volatility metrics.

### Features

- **11 Venue Support**: GMX V1/V2, dYdX V4, Hyperliquid, Drift, Perpetual Protocol, ApeX, Zeta Markets, Mango Markets, Kwenta, Synthetix V3
- **Funding Rate Tracking**: Current rate (1h, 8h, annualized), time to next payment
- **Open Interest & Skew**: Monitors total OI and long/short skew ratio
- **Extreme Rate Alerts**: Configurable threshold for extreme funding detection
- **Arbitrage Detection**: Cross-venue funding rate spread analysis with hedge ratio
- **Historical Analysis**: Rate history, volatility (std dev), mark/index price basis
- **Market Filtering**: Query specific markets or use venue defaults

### Architecture

```
agents/perps-funding-pulse/
├── src/
│   ├── index.ts    # Agent entrypoint (createAgentApp)
│   ├── agent.ts    # Core funding logic with 11 venue definitions
│   └── types.ts    # Zod schemas, venue enums, output interfaces
├── tests/
│   └── agent.test.ts  # 9 test cases
├── package.json
└── tsconfig.json
```

### Entrypoint

- **Key**: `funding_pulse`
- **Input**: `venue_ids[]`, `markets[]`, `extreme_threshold?`, `lookback_hours?`
- **Output**: `markets[]` (with `funding_rate`, `time_to_next`, `open_interest`, `skew`, `basis`, `history[]`, `rate_volatility`, `is_extreme`, `alerts[]`), `arbitrage_opportunities[]`, `extreme_rate_alerts[]`, `summary`

### Acceptance Criteria

Meets all specifications from the bounty issue:
- Returns live funding metrics for perps markets
- Matches expected data structure (funding_rate, time_to_next, open_interest, skew)
- Real-time data with configurable lookback
- Extreme rate detection with alerts
- Arbitrage opportunity identification

## Related Issue

#8 - Perps Funding Pulse

## Solana Wallet

<!-- TODO: Add your Solana wallet address -->

## Live Link

<!-- TODO: Add deployed agent URL -->

## Repository

Fork: https://github.com/billbtbillb-ui/agent-bounties
Directory: agents/perps-funding-pulse/
