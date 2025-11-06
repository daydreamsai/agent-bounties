# Wallet P&L Tracker Submission

## Bounty Issue
Closes #[ISSUE_NUMBER]

## Live Link
https://wallet-tracker-production-9b8c.up.railway.app/

## Manifest
https://wallet-tracker-production-9b8c.up.railway.app/.well-known/agent.json

## Repository
https://github.com/JustRahman/wallet-pnl-tracker

## Quick Test

### Calculate P&L for Vitalik's Wallet
```bash
curl -X POST https://wallet-tracker-production-9b8c.up.railway.app/entrypoints/calculate_pnl/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "wallet_address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "chains": ["ethereum", "base", "arbitrum"],
      "cost_basis_method": "fifo"
    }
  }'
```

### Calculate P&L with Token Filter
```bash
curl -X POST https://wallet-tracker-production-9b8c.up.railway.app/entrypoints/calculate_pnl/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "wallet_address": "0x992920386E3D950BC260f99C81FDA12419eD4594",
      "chains": ["ethereum", "polygon", "base"],
      "include_tokens": ["USDC", "USDT", "ETH"],
      "cost_basis_method": "avg",
      "time_period": "30d"
    }
  }'
```

### Test Endpoint
```bash
curl -X POST https://wallet-tracker-production-9b8c.up.railway.app/entrypoints/test/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"message": "Hello"}}'
```

## Wallet Addresses
**Solana:** EdTWN4SLpnBMnrwsmuD6nrbnDua5YDMJ1We3g8nmCZvS  
**EVM:** 0x992920386E3D950BC260f99C81FDA12419eD4594

## Technical Highlights
- ✅ Tracks P&L across 6+ EVM chains (Ethereum, Base, Arbitrum, Optimism, Polygon, BSC)
- ✅ Real-time transaction fetching via blockchain explorers
- ✅ Multiple cost basis methods (FIFO, LIFO, Average)
- ✅ Calculates both realized and unrealized P&L
- ✅ Token-by-token breakdown with price tracking
- ✅ Intelligent caching (600s TTL) to avoid rate limits
- ✅ Historical price data integration
- ✅ Time period filtering (24h, 7d, 30d, 90d, 1y, all)
- ✅ Comprehensive transaction history
- ✅ Response time < 5 seconds
- ✅ Full error handling and validation
- ✅ Built with @lucid-dreams/agent-kit

## Features

### Core Calculations
- **Realized P&L**: Profit/loss from completed trades (buy → sell)
- **Unrealized P&L**: Current value vs. cost basis for held tokens
- **Total P&L**: Combined realized + unrealized gains/losses
- **ROI Percentage**: Return on investment metrics
- **Initial Investment**: Total amount invested across all tokens

### Cost Basis Methods
- **FIFO** (First-In-First-Out): Sells oldest tokens first
- **LIFO** (Last-In-First-Out): Sells newest tokens first  
- **AVG** (Average): Uses average purchase price

### Multi-Chain Support
Aggregates transactions and balances from:
- Ethereum Mainnet
- Base
- Arbitrum
- Optimism
- Polygon
- Binance Smart Chain

### Additional Endpoints
- **mock_x402_payment**: Test X402 payment flow
- **test**: Health check and system status
- **clear_cache**: Cache management (all/transactions/prices)
- **cache_stats**: Cache performance metrics

## Acceptance Criteria Met
✅ Accurate P&L calculations verified across multiple wallets  
✅ Multi-chain transaction aggregation from blockchain explorers  
✅ Real-time price data integration  
✅ Deployed and reachable via agent-kit framework  
✅ Comprehensive error handling and validation  
✅ Token filtering and time period support  
✅ Multiple cost basis calculation methods

## Example Response
```json
{
  "summary": {
    "total_realized_pnl_usd": 1250.50,
    "total_unrealized_pnl_usd": 3400.75,
    "total_pnl_usd": 4651.25,
    "initial_investment_usd": 10000.00,
    "current_value_usd": 14651.25,
    "roi_percentage": 46.51
  },
  "by_token": [...],
  "transactions": [...],
  "metadata": {
    "wallet_address": "0x...",
    "chains_analyzed": ["ethereum", "base"],
    "total_transactions": 156,
    "analysis_timestamp": 1699200000000
  }
}
```
