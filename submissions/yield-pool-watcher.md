# Yield Pool Watcher - Submission

## Agent Description
A Cloudflare Worker-based AI agent that monitors the top 100 DeFi yield pools by TVL across Aave V3 (lending) and Uniswap V3 (DEX) on Ethereum. Polls subgraph data every 10 minutes, calculates APY and TVL deltas, evaluates against configurable thresholds, and exposes metrics + alerts via x402-payment-gated API endpoints.

## Live Deployment
Deployment URL: https://yield-pool-watcher.chirag.workers.dev

## Acceptance Criteria Checklist

### Core Functionality
- [x] Agent polls subgraph data every 10 minutes (cron trigger configured)
- [x] Agent calculates APY and TVL deltas between consecutive polls
- [x] Agent evaluates deltas against user-configurable thresholds
- [x] Agent stores triggered alerts with pool metadata
- [x] Agent exposes /metrics endpoint returning current pool data
- [x] Agent exposes /alerts endpoint returning triggered alerts

### Technical Requirements
- [x] Deployed as a Cloudflare Worker
- [x] Uses Cloudflare KV for state persistence
- [x] Uses Cron Triggers for scheduled execution
- [x] API endpoints gated via x402 payment
- [x] Delta calculations have zero-division protection
- [x] Alert cooldown per pool+metric set to 1 hour
- [x] Threshold validation with minimum values enforced

### DeFi Integration
- [x] Monitors Aave V3 lending pools via subgraph
- [x] Monitors Uniswap V3 DEX pools via subgraph
- [x] Supports top 100 pools by TVL with hourly refresh
- [x] APY calculations correct for lending vs DEX pools

## Solana Wallet for Payment
`CHIRAG_SOLANA_WALLET_ADDRESS`

## Implementation Details

### Architecture
```
┌─────────────────────────────────────────────────────┐
│                    Cron Trigger                       │
│               (every 10 minutes)                      │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                Worker Handler                         │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │ Subgraph    │  │ Delta Calc    │  │ Alert Engine ││
│  │ Querier     │──│ (APY + TVL)  │──│ (Thresholds) ││
│  └────────────┘  └──────────────┘  └──────┬───────┘│
│                                            │         │
│  ┌────────────┐                    ┌──────▼───────┐│
│  │ KV Store    │◄──────────────────│ Alert Writer  ││
│  │ (snapshots  │                   │ (cooldown)    ││
│  │  + alerts)  │                   └──────────────┘│
│  └────────────┘                                     │
└─────────────────────────────────────────────────────┘
```

### API Endpoints
- `GET /metrics` - Returns current pool metrics (APY, TVL) for all tracked pools
- `GET /alerts` - Returns triggered alerts with timestamps and severity
- `GET /health` - Health check endpoint

### Key Design Decisions
1. Separate cron worker from API worker for isolation
2. KV storage with 1-hour snapshot TTL and 24-hour alert TTL
3. Alert cooldown prevents spam (1 hour per pool+metric combo)
4. Zero-division protection in all delta calculations
5. Top 100 pool list refreshed hourly

## Additional Resources
- Source code: `workers/yield-pool-watcher/`
- x402 endpoint: https://yield-pool-watcher.chirag.workers.dev/x402/health
- Subgraph endpoints: Aave V3 (hosted), Uniswap V3 (hosted)
