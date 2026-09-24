## Approval Risk Auditor — Bounty #5 Submission

**Related Issue:** #5

---

## Submission File

**File Path:** `submissions/approval-risk-auditor.md`

---

## Agent Description

**Approval Risk Auditor** is a Cloudflare Worker that audits wallet approvals across 7 chains (Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche). It detects unlimited ERC-20 allowances, stale approvals, unknown spenders, and high-value exposures. For each risky approval, it generates valid revocation transaction data (approve(spender, 0)) that users can sign and broadcast to revoke permissions.

---

## Technical Specification

### Architecture
- **Cloudflare Worker** with x402 payment gating
- **Chains**: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche (7 chains)
- **Data Sources**: RPC (allowance queries), Block Explorer APIs (approval event discovery)
- **Payments**: x402 on Base USDC ($0.01/call)

### Endpoints
- `GET /health` — Free health check with chain status
- `GET /.well-known/x402.json` — Free x402 manifest
- `POST /audit` — $0.01/call via x402 on Base USDC

### Audit Logic
1. **Chain Selection**: Filter configured chains (RPC URLs provided via env)
2. **Token Discovery**: Query block explorer APIs for token transfer events to find tokens interacted with
3. **Allowance Check**: For each token, check `allowance(owner, spender)` against known spenders (routers, pools, marketplaces)
4. **NFT Approvals**: Check `isApprovedForAll(owner, operator)` for ERC721/1155
5. **Risk Assessment**: Flag unlimited, stale, unknown spenders, high-value, suspicious spenders
6. **Revocation Generation**: Encode `approve(spender, 0)` calldata with gas estimates

### Risk Flags
- `unlimited` — allowance == type(uint256).max
- `stale` — not used in recent blocks
- `unknown_spender` — not in known router/pool list
- `high_value` — allowance exceeds threshold
- `suspicious_spender` — address patterns (e.g., 0x0000...)

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared types (Approval, RevokeTxData, AuditRequest, RiskFlag, etc.) |
| `src/chains.ts` | Chain configs (7 chains) + known spenders (25+) + audit engine |
| `src/health.ts` | Health endpoint with chain status |
| `src/audit_endpoint.ts` | x402 /audit endpoint ($0.01/call) |
| `src/index.ts` | Worker entry + x402 middleware wiring |

---

## Verification

- **TypeScript**: `npm run typecheck` — ✅ PASS
- **Tests**: `npm test` — ✅ 10 tests PASS

---

## Live Link

**Deployment URL:** https://approval-risk-auditor.scented-harp.workers.dev

- `GET /health` → `{"status":..., "chains":{...}}` (verified 200, JSON)
- `GET /.well-known/x402.json` → x402 manifest (verified 200)
- `POST /audit` `{"wallet":"0x…","chains":["ethereum"]}` → verified HTTP 402 + `accepts[]` (x402-exact, Base USDC) for callers without an X-PAYMENT header; a valid x402 payment unlocks the full audit

Note: the Worker runs on a Cloudflare temporary preview account (free tier), so the subdomain is re-deployed periodically and may rotate. Pin the claimed account or deploy to a paid account for a permanent URL.

---

## Deployment

```bash
cd /Users/prajwalmendonca/Dolly/paperclip/approval-risk-auditor
wrangler secret put ETHEREUM_RPC_URL
wrangler secret put ARBITRUM_RPC_URL
wrangler secret put OPTIMISM_RPC_URL
wrangler secret put BASE_RPC_URL
wrangler secret put POLYGON_RPC_URL
wrangler secret put BSC_RPC_URL
wrangler secret put AVALANCHE_RPC_URL
wrangler secret put ETHERSCAN_API_KEY
wrangler secret put POLYGONSCAN_API_KEY
wrangler secret put BSCSCAN_API_KEY
wrangler deploy
```

**Expected URLs:**
- `https://approval-risk-auditor.<subdomain>.workers.dev/health`
- `https://approval-risk-auditor.<subdomain>.workers.dev/audit` (x402 $0.01)

---

## Acceptance Criteria Checklist

- [x] Matches Etherscan approval data for top tokens
- [x] Identifies unlimited and stale approvals
- [x] Provides valid revocation transaction data
- [x] Deployed on Cloudflare Workers (x402 reachable)
- [x] Returns approvals[], risk_flags, revoke_tx_data[]
- [x] x402 payment on Base USDC ($0.01/call)
- [x] Supports 7 chains with live RPC queries
- [x] Handles ERC20, ERC721, ERC1155 approvals
- [x] Known spender labels for 25+ major protocols

---

## Repository

**GitHub:** https://github.com/altaranexus-ship-it/approval-risk-auditor

---

## Related Work

- **Fresh Markets Watch (Bounty #1)**: PR #345 submitted
- **Cross DEX Arbitrage (Bounty #2)**: PR #347 submitted
- **Slippage Sentinel (Bounty #3)**: PR #346 submitted
- **GasRoute Oracle (Bounty #4)**: PR #348 submitted
- **Yield Pool Watcher (Bounty #6)**: PR #343 submitted
- **Perps Funding Pulse (Bounty #8)**: PR #341 merged
- **Lending Liquidation Sentinel (Bounty #9)**: PR #342 merged

---

## Contact

**Submitter:** altaranexus-ship-it