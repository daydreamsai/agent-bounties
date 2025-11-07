# KAMIYO Risk Auditor

**Related Issue:** Bounty #5 (Approval Risk Auditor)

**Submission File:** `submissions/defi-security-oracle.md`

## Agent Description

KAMIYO Risk Auditor provides token approval auditing and DeFi security intelligence for AI agents via x402 micropayments on Solana. The service scans wallet addresses across 7 EVM chains, detects risky token approvals, and generates ERC20 revocation transactions.

Core functionality:
- Scans token approvals via blockchain explorer APIs (Etherscan, Polygonscan, etc.)
- Detects risk factors: unlimited approvals, stale approvals, exploited protocols
- Generates valid ERC20 revocation transaction data
- Cross-references KAMIYO exploit database for protocol risk assessment

## Live Link

**Deployment:** https://risk-auditor.kamiyo.ai

**Primary Endpoint:** https://risk-auditor.kamiyo.ai/approval-audit

**Health Check:** https://risk-auditor.kamiyo.ai/health

**Repository:** https://github.com/kamiyo-ai/risk-auditor

## Acceptance Criteria

- [x] **Data Validation**: Matches approval data from blockchain explorers
- [x] **Risk Detection**: Identifies unlimited and stale approvals, plus exploited protocols
- [x] **Transaction Generation**: Provides valid ERC20 revocation transaction data
- [x] **x402 Deployment**: Deployed with x402 payment protocol integration
- [x] **Payment verification** using Solana on-chain verification
- [x] **Production ready** with rate limiting, validation, logging, and security features

## Technical Highlights

### Approval Auditing
- **Supported Chains**: Ethereum, Polygon, Base, Arbitrum, Optimism, BSC, Avalanche
- **Data Source**: Blockchain explorer APIs (Etherscan, Polygonscan, etc.)
- **Detection**: Active token approvals via approval events and current allowances
- **Caching**: 1-minute cache layer for performance

### Risk Detection
- **Unlimited Approvals**: MAX_UINT256 allowances flagged as high severity
- **Stale Approvals**: Approvals older than 6 months flagged as medium severity
- **Exploited Protocols**: Cross-references KAMIYO exploit database
- **Suspicious Spenders**: Known scam address flagging

### API Endpoints
1. **GET /approval-audit** - Audit wallet token approvals (x402 required)
   - Input: wallet address, chains array
   - Output: approvals, risk_flags, revoke_tx_data
2. **GET /exploits** - Recent exploit data (x402 required)
3. **GET /risk-score/:protocol** - Protocol risk assessment (x402 required)
4. **GET /health** - Service health check (free)

### Transaction Generation
- Valid ERC20 approve(spender, 0) calldata
- EIP-155 chain ID support
- Batch revocation support

## Performance Metrics

- **Response Time**: <500ms per request (excluding payment verification)
- **Payment Verification**: 2-3s (Solana RPC on-chain)
- **Approval Scan Cache**: 1-minute TTL
- **Payment Cache**: 1-hour TTL (multiple requests per transaction)
- **Rate Limit**: 60 requests/minute per IP
- **Uptime**: Production deployment on kamiyo.ai infrastructure

## Security Features

- Zod schema validation for all inputs
- Rate limiting (60 req/min per IP)
- Security headers middleware
- Request ID tracking
- Structured JSON logging
- Input sanitization
- On-chain payment verification (trustless)
- Payment replay protection (1-hour signature cache)

## Testing

The implementation has been validated against:
1. **Etherscan API Compatibility**: Approval data matches Etherscan for major tokens
2. **Risk Detection Accuracy**: Correctly identifies unlimited approvals (MAX_UINT256)
3. **Transaction Generation**: Valid ERC20 approve(spender, 0) calldata
4. **x402 Integration**: Solana payment verification and caching

## x402 Payment

**Network**: Solana mainnet
**Price**: 0.001 SOL per request
**Payment Wallet**: `CE4BW1g1vuaS8hRQAGEABPi5PCuKBfJUporJxmdinCsY`

Payment flow:
1. Create Solana transfer (0.001 SOL) to payment wallet
2. Get transaction signature
3. Send API request with X-PAYMENT header containing base64-encoded payment data
4. Middleware verifies signature on-chain
5. Cached for 1 hour (multiple requests per transaction)

## Resources

- **Repository:** https://github.com/kamiyo-ai/risk-auditor
- **Documentation:** [README](https://github.com/kamiyo-ai/risk-auditor/blob/main/README.md)
- **Architecture Diagrams:** ASCII diagrams in README showing system architecture, data flow, and payment flow
- **TypeScript Implementation:** Full source code with TypeScript, Express.js, and Zod validation

## Why This Agent

1. **Directly Addresses Bounty #5** - Complete implementation of Approval Risk Auditor requirements
2. **Real Blockchain Data** - Live integration with Etherscan and blockchain explorer APIs
3. **Valid Transaction Data** - Generates executable ERC20 revocation transactions
4. **Full x402 Compliance** - Complete v1 specification with Solana payment verification
5. **Production Ready** - Rate limiting, validation, logging, security headers, caching
6. **Security Intelligence** - Integrates KAMIYO exploit database for protocol risk assessment
7. **Multi-Chain Support** - 7 EVM chains with identical API interface

## Contact

- **Email:** dev@kamiyo.ai
- **GitHub:** https://github.com/kamiyo-ai/risk-auditor
- **Website:** https://kamiyo.ai

---

Built by KAMIYO for Daydreams AI Bounty #5 (Approval Risk Auditor)
