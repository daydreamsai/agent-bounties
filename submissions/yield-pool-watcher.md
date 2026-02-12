# Yield Pool Watcher - Daydreams Bounty #6 Submission

## Bounty Information
- **Issue**: [#6 Yield Pool Watcher](https://github.com/daydreamsai/agent-bounties/issues/6)
- **Reward**: $1,000
- **Submitted by**: @andygoodwill
- **Submission Date**: 2026-02-12

## Agent Overview

**Yield Pool Watcher** tracks APY and TVL across pools and alerts on sharp changes.

### Features

- ✅ Multi-protocol support (Aave, Compound, Curve)
- ✅ Real-time APY tracking
- ✅ TVL monitoring
- ✅ Threshold-based alerts
- ✅ Change detection

## Live Deployment

🌐 **API Endpoint**: https://explanation-except-daisy-andrea.trycloudflare.com

## API Documentation

### Monitor Pools
```bash
POST /monitor
Content-Type: application/json

{
  "protocol_ids": ["aave", "compound"],
  "pools": ["pool1", "pool2"]
}
```

## GitHub Repository

📁 **Source Code**: https://github.com/andygoodwill/yield-pool-watcher

## Acceptance Criteria

- [x] Detects TVL or APY change beyond thresholds within 1 block
- [x] Accurate metric tracking across major protocols
- [x] Deployed on domain with x402

## Payment Information

**Solana Wallet**: 3qUu5PdE6Gv4MHcKrLkmRdHGWTkf38LET6of1PCCyvVf

---

Built for Daydreams AI Agent Bounties
