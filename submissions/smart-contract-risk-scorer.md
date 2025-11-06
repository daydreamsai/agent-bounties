# Smart Contract Risk Scorer Submission

## Bounty Issue

Closes #[ISSUE_NUMBER]

## Live Link

https://smart-contract-risk-scorer-production.up.railway.app/

## Repository

https://github.com/JustRahman/smart-contract-risk-scorer

## Quick Test

### Analyze USDC Contract (Ethereum)
```bash
curl -X POST https://smart-contract-risk-scorer-production.up.railway.app/analyze \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <payment_signature>" \
  -d '{"contract_address":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","chain":"ethereum","scan_depth":"quick"}'
```

### Analyze Unknown Token (Deep Scan)
```bash
curl -X POST https://smart-contract-risk-scorer-production.up.railway.app/analyze \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <payment_signature>" \
  -d '{"contract_address":"0x[TOKEN_ADDRESS]","chain":"ethereum","scan_depth":"deep"}'
```

### Batch Analysis
```bash
curl -X POST https://smart-contract-risk-scorer-production.up.railway.app/analyze-batch \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <payment_signature>" \
  -d '{"contracts":["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","0xdAC17F958D2ee523a2206206994597C13D831ec7"],"chain":"ethereum","scan_depth":"quick"}'
```

## Wallet Addresses

**Solana:** EdTWN4SLpnBMnrwsmuD6nrbnDua5YDMJ1We3g8nmCZvS  
**EVM:** 0x992920386E3D950BC260f99C81FDA12419eD4594

## Technical Highlights

- ✅ Multi-source analysis: Etherscan, GoPlus Security, Token Sniffer APIs
- ✅ 15+ security checks (honeypot, hidden owner, proxy patterns, mint functions)
- ✅ Source code vulnerability detection (50+ malicious patterns)
- ✅ Bytecode analysis fallback for unverified contracts
- ✅ Ownership analysis (renounced, timelocks, multi-sig detection)
- ✅ Liquidity and LP lock verification
- ✅ Creator wallet history analysis (rug pull patterns)
- ✅ Holder concentration analysis (whale detection)
- ✅ Supports 5 chains (Ethereum, Polygon, Arbitrum, Optimism, Base)
- ✅ Full X402 payment integration (0.01 USDC on Base)
- ✅ SQLite caching for performance optimization
- ✅ Response time < 10 seconds for quick scans
- ✅ Risk scoring algorithm (0-100 with confidence levels)
- ✅ Actionable recommendations based on findings

## Acceptance Criteria Met

✅ Analyzes smart contracts for security risks and rug pull indicators  
✅ Multi-source verification (Etherscan + GoPlus + Token Sniffer)  
✅ Detects honeypots, hidden ownership, and malicious patterns  
✅ Source code + bytecode analysis capabilities  
✅ Risk score with confidence level and detailed findings  
✅ Response time < 10 seconds for quick scans  
✅ Deployed on domain and reachable via X402
