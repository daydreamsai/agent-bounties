# Token Holder Monitor Submission

## Bounty Issue

Closes #[ISSUE_NUMBER]

## Live Link

https://token-holder-checker-production.up.railway.app/

## Manifest

https://token-holder-checker-production.up.railway.app/.well-known/agent.json

## Repository

https://github.com/JustRahman/token-holder-monitor

## Quick Test

### Analyze Token Holders
```bash
curl -X POST https://token-holder-checker-production.up.railway.app/entrypoints/analyze_holders/invoke \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <payment_signature>" \
  -d '{"input":{"contract_address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","chain":"ethereum"}}'
```

### Health Check
```bash
curl -X POST https://token-holder-checker-production.up.railway.app/entrypoints/health/invoke \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <payment_signature>" \
  -d '{"input":{}}'
```

## Wallet Addresses

**Solana:** EdTWN4SLpnBMnrwsmuD6nrbnDua5YDMJ1We3g8nmCZvS  
**EVM:** 0x992920386E3D950BC260f99C81FDA12419eD4594

## Technical Highlights

- ✅ Real-time holder distribution analysis
- ✅ Whale wallet identification and tracking
- ✅ Centralization risk metrics (Gini coefficient, HHI index)
- ✅ Top holder concentration analysis
- ✅ Large transfer detection and alerts
- ✅ Multi-chain support (Ethereum, Polygon, Arbitrum, Optimism, Base)
- ✅ Etherscan API integration for holder data
- ✅ Historical holder pattern analysis
- ✅ Risk scoring based on distribution metrics
- ✅ Full X402 payment integration (0.01 USDC on Base)
- ✅ Built with @lucid-dreams/agent-kit
- ✅ Auto-generated manifest and documentation
- ✅ Response time < 5 seconds

## Acceptance Criteria Met

✅ Monitors token holder distributions across multiple chains  
✅ Identifies whale wallets and concentration risks  
✅ Calculates centralization metrics (Gini, HHI)  
✅ Generates alerts for large holder activity  
✅ Real-time data from blockchain APIs  
✅ Deployed on domain and reachable via X402
