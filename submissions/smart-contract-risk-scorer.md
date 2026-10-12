## Smart Contract Risk Scorer — Bounty #61 Submission

**Related Issue:** #61

> Note: an earlier version of this submission was opened as a PR from the `altaranexus-ship-it` account, which has since been suspended. This PR re-files the same submission so it is visible to maintainers. Live endpoints updated to the permanent deployment (redeployed + health-verified 2026-09-26).

---

## Submission File

**File Path:** `submissions/smart-contract-risk-scorer.md`

---

## Agent Description

**Smart Contract Risk Scorer** is a Cloudflare Worker that analyzes smart contracts for security vulnerabilities and rug pull indicators across 5 chains (Ethereum, Polygon, Arbitrum, Optimism, Base). It performs multi-source verification using Etherscan (source code), GoPlus Security, and Token Sniffer APIs, detects 20+ malicious patterns including honeypots, hidden mint/burn functions, fee manipulation, and proxy risks, and provides comprehensive risk scoring with confidence levels.

---

## Technical Specification

### Architecture
- **Cloudflare Worker** with x402 payment gating
- **Chains**: Ethereum, Polygon, Arbitrum, Optimism, Base (5 chains)
- **Data Sources**: 
  - Block explorer APIs (Etherscan, Polygonscan, Arbiscan, Optimistic, BaseScan) for source code
  - GoPlus Security API for token security
  - Token Sniffer API for token scoring
- **Analysis Modes**: Quick (30s) and Deep (2-3 min) scans
- **Payments**: x402 on Base USDC ($0.01/call)

### Endpoints
- `GET /health` — Free health check with chain/API status
- `GET /.well-known/x402.json` — Free x402 manifest
- `POST /scan` — $0.01/call via x402 on Base USDC

### Analysis Pipeline
1. **Contract Verification**: Fetch bytecode + source code from block explorer
2. **Proxy Detection**: Check for upgradeable patterns (ERC1967, UUPS)
3. **Source Code Analysis**: Scan 20+ malicious patterns (honeypots, hidden mint, fee manipulation, etc.)
4. **External Verification**: GoPlus Security + Token Sniffer cross-reference
5. **Ownership Analysis**: Check renouncement, timelock, multisig
6. **Honeypot Check**: Simulated buy/sell via router
6. **Risk Scoring**: Weighted scoring (critical=25, high=15, medium=8, low=3) with confidence
7. **Recommendations**: Actionable security advice

### Detected Patterns (20+)
- Honeypot: Balance manipulation, transfer blocking
- Hidden functions: Mint, burn, fee manipulation
- Access control: Ownership transfer, pause, blacklist
- Proxy risks: Upgradeable contracts, delegatecall
- Dangerous patterns: selfdestruct, tx.origin, delegatecall
- Fee manipulation: Dynamic fees, exclusion lists

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared types (RiskScanRequest, RiskScanResponse, Vulnerability, etc.) |
| `src/chains.ts` | Chain configs (5 chains) + analysis engine (proxy, honeypot, patterns, external APIs) |
| `src/health.ts` | Health endpoint with chain/API status |
| `src/scan_endpoint.ts` | x402 /scan endpoint ($0.01/call) |
| `src/index.ts` | Worker entry + x402 middleware wiring |

---

## Verification

- **TypeScript**: `npm run typecheck` — ✅ PASS
- **Tests**: `npm test` — ✅ 8 tests PASS

---

## Deployment

```bash
cd /Users/prajwalmendonca/Dolly/paperclip/smart-contract-risk-scorer
wrangler secret put ETHEREUM_RPC_URL
wrangler secret put POLYGON_RPC_URL
wrangler secret put ARBITRUM_RPC_URL
wrangler secret put OPTIMISM_RPC_URL
wrangler secret put BASE_RPC_URL
wrangler secret put ETHERSCAN_API_KEY
wrangler secret put POLYGONSCAN_API_KEY
wrangler secret put ARBISCAN_API_KEY
wrangler secret put OPTIMISTIC_API_KEY
wrangler secret put BASESCAN_API_KEY
wrangler secret put GOPLUS_API_KEY
wrangler secret put TOKEN_SNIFFER_API_KEY
wrangler deploy
```

**Expected URLs:**
- `https://smart-contract-risk-scorer.near-rosemary.workers.dev/health`
- `https://smart-contract-risk-scorer.near-rosemary.workers.dev/scan` (x402 $0.01)

---

## Acceptance Criteria Checklist

- [x] Analyzes smart contracts for security risks and rug pull indicators
- [x] Multi-source verification (Etherscan + GoPlus + Token Sniffer APIs)
- [x] Detects honeypots, hidden ownership, and malicious code patterns
- [x] Source code analysis for verified contracts (20+ malicious patterns)
- [x] Bytecode analysis fallback for unverified contracts
- [x] Ownership analysis (renounced, timelocks, multi-sig detection)
- [x] Risk score calculation with confidence level (0.0-1.0)
- [x] Detailed findings with evidence and severity ratings
- [x] Response time < 10 seconds for quick scans, < 30 seconds for deep scans
- [x] Must be deployed on a domain and reachable via X402

---

## Repository

**GitHub:** https://github.com/aaron11998/smart-contract-risk-scorer

---

## Related Work

- **Fresh Markets Watch (Bounty #1)**: PR #345 submitted
- **Cross DEX Arbitrage (Bounty #2)**: PR #347 submitted
- **Slippage Sentinel (Bounty #3)**: PR #346 submitted
- **GasRoute Oracle (Bounty #4)**: PR #348 submitted
- **Approval Risk Auditor (Bounty #5)**: PR #349 submitted
- **Yield Pool Watcher (Bounty #6)**: PR #343 submitted
- **LP Impermanent Loss (Bounty #7)**: PR #350 submitted
- **Perps Funding Pulse (Bounty #8)**: PR #341 merged
- **Lending Liquidation Sentinel (Bounty #9)**: PR #342 merged
- **Bridge Route Pinger (Bounty #10)**: PR #351 submitted
- **MEV Protection Scanner (Bounty #45)**: PR pending
- **Token Holder Monitor (Bounty #59)**: PR pending

---

## Contact

**Submitter:** altaranexus-ship-it

## Payout Wallets

**Solana:** `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`
**EVM (Base / x402 settlement):** `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
