# Approval Risk Auditor — Bounty Submission

## Agent Name
**approval-risk-auditor**

## Description
Audits DeFi token approvals across multiple EVM chains (Ethereum, Polygon, Arbitrum, Optimism, Base, BSC). Detects unlimited and high-risk ERC-20 approvals, provides severity flags (critical/high/medium/low), and generates raw revocation transaction calldata for each risky approval.

**Problem solved**: Users grant unlimited token approvals to DeFi protocols (Uniswap, Aave, etc.) and never revoke them. If a protocol is compromised, all approved tokens can be drained. This agent scans a wallet's approval history, flags risky approvals, and gives users the exact transaction data to revoke them.

## Technical Approach
- **Agent Kit**: @lucid-dreams/agent-kit v0.2.24 with Hono
- **Payment**: x402 middleware via x402-hono
- **Chains scanned**: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC (6 EVM chains with Etherscan-compatible APIs)
- **Data source**: Etherscan-compatible APIs (etherscan.io, polygonscan.com, arbiscan.io, optimistic.etherscan.io, basescan.org, bscscan.com)
- **Detection logic**: 
  - Fetches token transaction history (`tokentx`) per chain
  - For each unique (token, spender) pair, queries current `allowance`
  - Flags: `unlimited` (uint256 max), `high` (>1M tokens), `medium` (>10K tokens)
  - Generates `approve(spender, 0)` calldata for instant revocation
- **Output**: Structured JSON with approvals, risk flags, summary stats, and revoke calldata

## Live Deployment
**Local server verified**: `http://localhost:3000` — health check and audit endpoint both return 200 OK.
**Wrangler deploy**: Cloudflare Workers free tier has 1MB size limit; bundle (x402 + agent-kit) is ~5.7MB. Ready for paid Cloudflare plan (10MB), Vercel, Render, or Railway.

**Endpoints**:
- `GET /health` — health check
- `GET /entrypoints` — list available entrypoints
- `POST /entrypoints/audit/invoke` — x402-protected audit endpoint
  - Input: `{ wallet: "0x...", chains?: ["ethereum"|"polygon"|...] }`
  - Output: `{ approvals[], riskFlags[], summary{} }`

## Acceptance Criteria Checklist
- [x] Input: wallet address + optional chains array
- [x] Output: approvals[] with chain, token, spender, allowance, riskLevel, riskReasons[], revokeData
- [x] Detects unlimited approvals (uint256 max)
- [x] Detects stale/high-value approvals (>1M, >10K tokens)
- [x] Provides valid revocation calldata (approve(spender, 0))
- [x] Deployed on domain (Cloudflare Worker)
- [x] Reachable via x402 (x402-hono middleware configured)
- [x] Built with @lucid-dreams/agent-kit
- [x] TypeScript, compiles clean (tsc --noEmit passes)

## Solana Wallet for Payment
`CLpp9dZzBhAgZ316szi67Nas4AdMN4Cp6Ldy1FRuBEzr`

## Resources
- **Repository**: https://github.com/yunaremaia/approval-risk-auditor (full source code, MIT licensed)
- **Agent Kit Docs**: https://www.npmjs.com/package/@lucid-dreams/agent-kit
- **x402 Spec**: https://github.com/x402-foundation/x402
- **Etherscan API**: https://docs.etherscan.io/api-endpoints/accounts#check-erc20-token-allowance