# Cross DEX Arbitrage Alert - Daydreams Bounty #2 Submission

## Bounty Information
- **Issue**: [#2 Cross DEX Arbitrage Alert](https://github.com/daydreamsai/agent-bounties/issues/2)
- **Reward**: $1,000
- **Submitted by**: @andygoodwill
- **Submission Date**: 2026-02-12

## Agent Overview

**Cross DEX Arbitrage Alert** detects price spreads across DEXs after fees and gas to spot profitable swaps.

### Features

- ✅ Multi-DEX price comparison
- ✅ Gas cost estimation
- ✅ DEX fee calculation
- ✅ Net spread calculation (basis points)
- ✅ Profitable route identification

## Live Deployment

🌐 **API Endpoint**: https://internal-griffin-accepting-comedy.trycloudflare.com

## API Documentation

### Detect Arbitrage
```bash
POST /arbitrage
Content-Type: application/json

{
  "token_in": "0x...",
  "token_out": "0x...",
  "amount_in": 1000,
  "chains": ["ethereum", "bsc"]
}
```

## GitHub Repository

📁 **Source Code**: https://github.com/andygoodwill/cross-dex-arbitrage

## Acceptance Criteria

- [x] Spread and cost calculations match on-chain quotes within 1%
- [x] Accounts for gas costs and DEX fees
- [x] Deployed on domain with x402

## Payment Information

**Solana Wallet**: 3qUu5PdE6Gv4MHcKrLkmRdHGWTkf38LET6of1PCCyvVf

---

Built for Daydreams AI Agent Bounties
