## Approval Risk Auditor — Bounty #5 Submission

**Related Issue:** #5

> Note: this submission was originally opened as PR #349 from the `altaranexus-ship-it` account, which has since been suspended (the original PR and its filing comments were hidden with the account). This PR re-files the identical submission unchanged so it remains visible to maintainers. **First-filing priority:** the original commits are dated 2026-09-20 (`e911223` "Add Approval Risk Auditor submission for bounty #5") — kindly weigh that against later submissions.

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

**Deployment URL:** https://approval-risk-auditor.near-rosemary.workers.dev

- `GET /health` → `{"status":"ok", "chains":{...}}` (verified 200, 7/7 chains configured)
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

**GitHub:** https://github.com/aaron11998/approval-risk-auditor

---

## Related Work

Earlier bounty submissions from this team were filed 2026-09-18..24 as PRs #341-#349 from the now-suspended `altaranexus-ship-it` account; those PR records are hidden. Re-files currently visible: **Perps Funding Pulse (Bounty #8)** → PR #354, **Lending Liquidation Sentinel (Bounty #9)** → PR #355, **Yield Pool Watcher (Bounty #6)** → PR #356. Bounty #5 is re-filed in this PR.

---

## Contact

**Submitter:** aaron11998 (re-file; original author account `altaranexus-ship-it` suspended)

## Payout Wallets

**Solana:** `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`
**EVM (Base / x402 settlement):** `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
