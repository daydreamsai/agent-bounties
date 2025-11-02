# Bounty Submission - Onchain Reputation Agent

## Related Issue: Open Scope Submission

This is an **open scope** bounty submission. The idea was proposed to and approved by the creator(loaf) before development.

## Agent Description

**Onchain Reputation Agent** is an intelligent security assistant that evaluates the trust and risk level of any EVM wallet or smart contract using comprehensive onchain data and offchain security signals. It provides **4 specialized endpoints** for different security analysis use cases:

1. **check_reputation** - Full reputation analysis with trust scores (0-100), risk levels, and actionable recommendations
2. **analyze_reputation** - Simplified reputation metrics optimized for dashboards and quick overviews
3. **scam_detector** - Binary scam detection with quick/deep modes for phishing and honeypot detection
4. **onchain_activity** - Detailed transaction pattern analysis and behavioral metrics

The agent analyzes addresses across **6 EVM chains** (Ethereum, Base, BSC, Polygon, Arbitrum, Optimism) by aggregating data from multiple security sources including Etherscan, GoPlus Security, and ScamSniffer's phishing blacklist (4,600+ known scammers).

## Live Link

- **Deployment URL**: (https://onchain-reputation-agent.arumam.engineer/)
- **Manifest**: (https://onchain-reputation-agent.arumam.engineer/.well-known/agent.json)
- **GitHub Repository**: (https://github.com/basstimam/onchain-reputation-agent)
- **x402scan agent** : (https://www.x402scan.com/composer/agent/874fe532-26e9-487a-89fe-2f5aa819d517)

## Acceptance Criteria

* [x] Deployed on a publicly reachable domain with production environment
* [x] x402 payments enabled (`0.02 USDC` per endpoint invoke price)
* [x] All 4 entrypoints functional and properly documented
* [x] Returns comprehensive security analysis with multi-source data aggregation
* [x] CORS enabled for x402scan composer integration
* [x] Manifest properly exposed at `/.well-known/agent.json`
* [x] Complete documentation with prompt examples and testing guides

## Key Features

### Multi-Endpoint Architecture
- **check_reputation**: Comprehensive security audits for due diligence (3-5s response)
- **analyze_reputation**: Quick reputation scores for monitoring (3-5s response)
- **scam_detector**: Urgent pre-transaction validation (<1s quick mode, 3-5s deep mode)
- **onchain_activity**: Portfolio analytics and behavioral tracking (2-3s response)

### Data Sources & Security
- **Etherscan API**: Contract verification, transaction history, deployment dates (all 6 chains)
- **GoPlus Security**: Honeypot detection, token analysis, malicious contract detection
- **ScamSniffer**: Real-time phishing blacklist (4,600+ addresses, auto-updated daily)

### Risk Scoring Algorithm
```
Score = BaseScore(50)
  + Verified Contract(+15)
  + Long History(+10)
  + High Transaction Volume(+5)
  - Flagged Interactions(-30)
  - Blacklist Status(-40)
  - Abnormal Token Movement(-20)
  - High-Frequency Activity(-10)

Risk Levels:
- LOW (70-100): Safe to interact
- MEDIUM (40-69): Exercise caution
- HIGH (0-39): Avoid interaction
```




## Documentation

- **README**: [Complete setup and usage guide](https://github.com/basstimam/onchain-reputation-agent/blob/master/README.md)
- **PRODUCTION TESTING DEMO**: [Full Test Results & Analysis](https://github.com/basstimam/onchain-reputation-agent/blob/master/PRODUCTION_TESTING_DEMO.md)


## Wallet Addresses

- **EVM Wallet**: `0x892e4feed0128f11d486fd451aff4a78171c8748` (for x402 wallet agent, base)
- **Solana Wallet**: `9Bxn6CsqLcciGWVuPcwTVp7oyEVi815Y9Nx7TLg22Hp7`



## Additional Notes

### Production Readiness
- ✅ CORS enabled for web client integration
- ✅ Environment variables configured for production (Vercel)
- ✅ Error handling and retry logic implemented
- ✅ Rate limiting considerations for external APIs
- ✅ Automatic phishing blacklist updates (daily cron)

### Unique Value Propositions
1. **Multi-endpoint architecture** allows specialized queries vs single-purpose agents
2. **3+ data source aggregation** provides more reliable security assessments
3. **Real-time phishing detection** via ScamSniffer integration
4. **Cross-chain analysis** across 6 major EVM networks
5. **Flexible check modes** (quick vs deep) for different urgency levels

### Testing Coverage
- Unit tests for core reputation logic
- Integration tests for all 4 endpoints
- Real-world address testing (safe & risky addresses)
- Payment flow testing with x402 protocol
- Multi-chain testing across all supported networks

### Open Scope Justification
This agent fills a critical gap in the Web3 security ecosystem by providing:
- **Proactive security** before transactions (vs reactive fraud detection)
- **Multi-dimensional analysis** (reputation + scam + activity)
- **AI-ready format** for LLM integration and agentic workflows
- **Monetizable API** with clear x402 payment integration

The 4-endpoint design allows developers and AI agents to choose the right tool for their specific security needs, from quick scam checks to comprehensive security audits.


---

**Submission Date**: 2 November 2025
**Version**: 1.0.0
**Status**: Production Ready ✅