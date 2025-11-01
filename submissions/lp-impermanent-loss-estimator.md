# LP Impermanent Loss Estimator

## Agent Description
An AI agent that calculates impermanent loss and fee APR for liquidity provider positions using real historical price data from CoinGecko. Helps DeFi users understand their LP position performance by comparing hodling vs providing liquidity.

## Live Deployment
**Base URL:** https://lp-impermanent-loss-estimator-production.up.railway.app

**x402 Endpoint:** https://lp-impermanent-loss-estimator-production.up.railway.app/calculate-il-x402

**Health Check:** https://lp-impermanent-loss-estimator-production.up.railway.app/health

**Entrypoints:** https://lp-impermanent-loss-estimator-production.up.railway.app/entrypoints

## x402 Payment Details
- **Price:** $0.10 USDC per calculation
- **Network:** Base
- **Payment Asset:** USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- **Wallet Address:** 0xe7A413d4192fdee1bB5ecdF9D07A1827Eb15Bc1F
- **x402scan:** Registered at https://www.x402scan.com/

## Related Bounty
**Issue:** [#7 - Build an Agent](https://github.com/daydreamsai/agent-bounties/issues/7)

## Solana Wallet Address
4K7a18QwGBJ6DqesMbvc5iovQWPsvBhopmBqqb6rRVHq

## Features
- Calculates impermanent loss using constant product formula (x × y = k)
- Fetches real historical price data from CoinGecko API
- Estimates fee APR based on pool type (stable vs volatile)
- Provides net P&L analysis (IL + fees earned)
- Gives actionable recommendations

## Supported Token Pairs
- ETH/WETH, BTC/WBTC, USDC, USDT, DAI
- Works with any combination of supported tokens

## Technical Stack
- **Framework:** @lucid-dreams/agent-kit v0.2.22
- **Runtime:** Node.js v20 with tsx
- **Web Framework:** Hono v4.0+
- **Payment Protocol:** x402
- **Deployment:** Railway
- **Language:** TypeScript

## Additional Resources
- **Source Code:** https://github.com/natefrog808/LP-Impermanent-Loss-Estimator
- **Documentation:** See README.md in repository
- **x402 Integration:** Fully compliant with x402 protocol and registered on x402scan

## Test Example
```bash
# Get 402 payment details
curl -i https://lp-impermanent-loss-estimator-production.up.railway.app/calculate-il-x402

# Returns HTTP 402 with payment schema
```

## Acceptance Criteria Met
✅ Agent is deployed and reachable via x402  
✅ Agent performs a useful, non-trivial function  
✅ Documentation is clear and complete  
✅ x402 payment integration is working  
✅ Registered on x402scan ecosystem explorer  

## Submission Date
November 1, 2025
