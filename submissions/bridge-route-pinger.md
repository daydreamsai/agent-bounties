# Bridge Route Pinger Submission

## Bounty Issue
Closes #10

## Live Link
https://bridge-route-pinger-production.up.railway.app/

## Manifest
https://bridge-route-pinger-production.up.railway.app/.well-known/agent.json

## Repository
https://github.com/JustRahman/bridge-route-pinger

## Quick Test
### USDC Ethereum → Polygon
curl -X POST https://bridge-route-pinger-production.up.railway.app/api/v1/bridge/routes \
  -H "Content-Type: application/json" \
  -H "X-Payment-Token: test_token_123" \
  -H "X-Payment-Amount: 0.02" \
  -H "X-Payment-Currency: USDC" \
  -d '{"token":"USDC","amount":"100","from_chain":"ethereum","to_chain":"polygon"}'

### ETH Ethereum → Arbitrum
curl -X POST https://bridge-route-pinger-production.up.railway.app/api/v1/bridge/routes \
  -H "Content-Type: application/json" \
  -H "X-Payment-Token: test_token_123" \
  -H "X-Payment-Amount: 0.02" \
  -H "X-Payment-Currency: USDC" \
  -d '{"token":"ETH","amount":"0.5","from_chain":"ethereum","to_chain":"arbitrum"}'

## Wallet Addresses
**Solana:** EdTWN4SLpnBMnrwsmuD6nrbnDua5YDMJ1We3g8nmCZvS  
**EVM:** 0x992920386E3D950BC260f99C81FDA12419eD4594

## Technical Highlights
- ✅ Aggregates routes from LI.FI (15+ bridges including Across, Stargate, Connext)
- ✅ 30-second caching for optimal performance
- ✅ Sorts routes by total cost (fees + gas)
- ✅ Recommends best route with reasoning
- ✅ Supports 5 chains (Ethereum, Polygon, Arbitrum, Optimism, Base)
- ✅ Supports 4 tokens (USDC, USDT, ETH, WETH)
- ✅ Full X402 payment integration (0.02 USDC)
- ✅ Response time < 3 seconds
- ✅ Comprehensive error handling
- ✅ No API keys required

## Acceptance Criteria Met
✅ Quotes align with on-chain/official bridge endpoints (LI.FI aggregator)  
✅ Accurate fee and time estimates (verified with live tests)  
✅ Deployed on domain and reachable via X402