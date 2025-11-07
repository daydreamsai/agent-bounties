# DeFi Security Oracle

**Related Issue:** Bounty #5 (Approval Risk Auditor) / Bounty #9 (Lending Liquidation Sentinel)

**Submission File:** `submissions/defi-security-oracle.md`

## Agent Description

DeFi Security Oracle provides real-time exploit intelligence and protocol risk assessment for AI agents via x402 micropayments. Built on KAMIYO Security Intelligence Platform, aggregating exploit data from 20+ sources including CertiK, Immunefi, Rekt News, SlowMist, and PeckShield.

The oracle enables AI agents to assess security risks before interacting with DeFi protocols, protecting users from exploited or vulnerable contracts.

## Live Link

**Deployment:** https://security-oracle.onrender.com

**x402 Endpoint:** https://security-oracle.onrender.com/exploits

**Health Check:** https://security-oracle.onrender.com/health

**Repository:** https://github.com/kamiyo-ai/security-oracle

## Acceptance Criteria

- [x] **Deployed and accessible** via x402 protocol
- [x] **Real-time data** from production KAMIYO API (20+ sources)
- [x] **Payment verification** using Solana on-chain verification
- [x] **Protocol compliance** with x402 v1 specification
- [x] **Production ready** with rate limiting, validation, logging, and tests
- [x] **Documentation** including README, architecture docs, and client examples

## Technical Highlights

### Multi-Chain Support
- Ethereum, Base, Polygon, Avalanche, Arbitrum, Optimism, BSC, Solana, Fantom, Gnosis, Celo, Moonbeam, Moonriver
- Cross-chain exploit tracking and risk analysis

### Data Sources (20+)
- Security Firms: CertiK, PeckShield, SlowMist, BlockSec, Dedaub
- Bug Bounties: Immunefi, HackerOne
- Research: Rekt News, OpenZeppelin, Quantstamp
- Real-time aggregation with hourly updates

### API Endpoints
1. **GET /exploits** - Recent exploit data filtered by protocol/chain (x402 required)
2. **GET /risk-score/:protocol** - Multi-factor risk assessment (x402 required)
3. **GET /health** - Service health and capabilities (free)

### Risk Scoring Algorithm
- Exploit Frequency (40%): 30-day incident count
- Total Loss (30%): Cumulative USD losses
- Recency (30%): Time since latest exploit
- Risk Levels: CRITICAL (75-100), HIGH (50-74), MEDIUM (25-49), LOW (0-24)

## Performance Metrics

- **Response Time:** <500ms (excluding payment verification)
- **Payment Verification:** 2-3s (Solana RPC on-chain)
- **Data Freshness:** Hourly updates from KAMIYO
- **Cache Duration:** 1 hour (payments), 5 minutes (data)
- **Rate Limit:** 60 requests/minute per IP
- **Uptime:** 99%+ (Render infrastructure)

## Security Features

- On-chain payment verification (trustless)
- Payment replay protection (1-hour signature cache)
- Rate limiting per IP (60 req/min)
- Input validation (Zod schemas with regex/length limits)
- Request ID tracking (audit trail)
- Security headers (HSTS, CSP, X-Frame-Options)
- No private key storage (read-only wallet)

## Testing

- **28 tests passing** (validation, x402 protocol, data service)
- **6 integration tests skipped** (require live RPC)
- **Test framework:** Jest with TypeScript
- **Coverage:** Core functionality and edge cases

## Solana Wallet

**Address:** `HnxC9Y8KLh8iqTvdoSDMAQvdkdnrRcXvAqGz7UJUPvHN`

**Initial Balance:** 0 SOL (agents fund on first use)

## Resources

- **Repository:** https://github.com/kamiyo-ai/security-oracle
- **Documentation:** [README](https://github.com/kamiyo-ai/security-oracle/blob/main/README.md)
- **Architecture:** [ARCHITECTURE.md](https://github.com/kamiyo-ai/security-oracle/blob/main/ARCHITECTURE.md)
- **x402 Compliance:** [X402_COMPLIANCE.md](https://github.com/kamiyo-ai/security-oracle/blob/main/X402_COMPLIANCE.md)
- **Client Examples:** TypeScript and Python in `examples/` directory

## Why This Agent

1. **Production Infrastructure** - Built on real KAMIYO platform, not mock data
2. **Real Data** - Actual exploit aggregation from 20+ sources since 2020
3. **Full x402 Compliance** - Complete v1 specification implementation
4. **Well-Tested** - 28 tests covering core functionality
5. **Extensively Documented** - 6 detailed documentation files
6. **Sustainable** - Part of existing security platform
7. **Multi-Bounty Support** - Enables #5 (Approval Risk), #9 (Liquidation), #3 (Slippage)

## Contact

- **Email:** dev@kamiyo.ai
- **GitHub:** https://github.com/kamiyo-ai/security-oracle
- **Website:** https://kamiyo.ai

---

Built by KAMIYO for the Daydreams x402 Bounty Program
