# LP Impermanent Loss Estimator Submission for Issue #7

**Live Agent:** https://lp-impermanent-loss-estimator-production.up.railway.app/  

**Source Code:** https://github.com/natefrog808/lp-impermanent-loss-estimator  

**Base Wallet Address:** 0xe7A413d4192fdee1bB5ecdf9D07A1827Eb15Bc1F  

**Solana Wallet Address:** 4K7a18QwGBJ6DqesMbvc5iovQWPsvBhopmBqqb6rRVHq  

## What It Does
An AI agent that calculates impermanent loss and fee APR for liquidity provider positions using real historical price data from CoinGecko.

## Key Features
- ✅ Real historical price data from CoinGecko API
- ✅ Accurate IL calculation using constant product formula
- ✅ Fee APR estimation based on pool type
- ✅ Net P&L analysis (IL + fees)
- ✅ Actionable recommendations
- ✅ x402 payment integration ($0.10 per calculation)
- ✅ Supports major tokens (ETH, BTC, USDC, USDT, DAI)

## Quick Test
```bash
curl -X POST https://lp-impermanent-loss-estimator-production.up.railway.app/entrypoints/calculate-il \
  -H "Content-Type: application/json" \
  -d '{
    "token0Symbol": "ETH",
    "token1Symbol": "USDC",
    "token0Amount": 1.5,
    "token1Amount": 3000,
    "daysHeld": 30
  }'
