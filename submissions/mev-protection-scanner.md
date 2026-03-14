# MEV Protection Scanner

## Agent Description
Detect MEV (Maximal Extractable Value) attacks before they happen: sandwich attacks, front-running, and back-running risks. Returns risk assessment and actionable protection strategies.

## Bounty Issue
Closes #45

## Live Deployment
- **URL:** http://65.108.87.255:8086
- **Entrypoints:** `GET /entrypoints` | `POST /entrypoints/scan_mev/invoke`
- **Health:** `GET /health`

## Features
- Scans trades for sandwich attack, front-run, and back-run risk
- Computes risk score (0–100) from price impact, gas percentile, mempool congestion, trade size
- Fetches real-time gas oracle data (Etherscan gas tracker)
- Estimates price impact using DEX fee profiles
- Returns competing tx count, gas price percentile
- Provides actionable protection suggestions (Flashbots, Cowswap, gas adjustments, slippage tuning)

## Example Usage
```bash
curl -X POST http://65.108.87.255:8086/entrypoints/scan_mev/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "token_in": "USDC",
      "token_out": "ETH",
      "amount_in": 10000,
      "dex": "uniswap-v2"
    }
  }'
```

## Response Schema
```json
{
  "token_in": "USDC",
  "token_out": "ETH",
  "amount_in": 10000,
  "dex": "uniswap-v2",
  "risk_score": 55,
  "risk_level": "high",
  "attack_type": "front-run",
  "estimated_loss_usd": 33,
  "estimated_loss_pct": 0.33,
  "protection_suggestions": [
    "Increase gas price to at least 50.0 Gwei to reduce mempool wait time",
    "Consider using Cowswap (batch auctions eliminate sandwich attacks)",
    "Use commit-reveal scheme or time-locked transactions for large orders",
    "Monitor the transaction using Flashbots MEV explorer after submission"
  ],
  "competing_txs": 118,
  "gas_price_percentile": 33,
  "mempool_data": {
    "pending_tx_count": 118,
    "avg_gas_price_gwei": 30,
    "fast_gas_price_gwei": 50,
    "safe_gas_price_gwei": 20,
    "block_time_ms": 12000
  },
  "market_data": {
    "price_impact_pct": 1.0,
    "pool_liquidity_usd": 1000000,
    "slippage_estimate_pct": 1.2,
    "dex_fee_pct": 0.3
  },
  "analyzed_at": "2026-03-14T20:00:00.000Z"
}
```

## Supported DEXes
- `uniswap-v2`, `uniswap-v3`
- `sushiswap`, `curve`, `balancer`, `pancakeswap`

## Solana Wallet (for bounty payment)
`o27qQ458k5zVp4P3ajtn1ksu6d5xcvBTM5KYpCmbhYP`

## Technology Stack
- TypeScript + `@lucid-dreams/agent-kit`
- Etherscan Gas Oracle for real-time mempool data
- DEX fee profile modeling for price impact estimation
- x402 payment middleware integrated
- Deployed on Linux VPS (65.108.87.255)
