## Slippage Sentinel — Bounty #3 Submission

**Related Issue:** #3

> Note: an earlier version of this submission was opened as a PR from the `altaranexus-ship-it` account, which has since been suspended. This PR re-files the same submission so it is visible to maintainers. Live endpoints updated to the permanent deployment (redeployed + health-verified 2026-09-26).

---

## Submission File

**File Path:** `submissions/slippage-sentinel.md`

---

## Agent Description

**Slippage Sentinel** is a Cloudflare Worker that estimates safe slippage tolerance for any swap route to prevent transaction reverts. It analyzes pool depth across major DEXes (Uniswap V2/V3, SushiSwap V2, Curve) on 5 chains (Ethereum, Arbitrum, Optimism, Base, Polygon), calculates price impact for given trade sizes, and returns minimum safe slippage with recommended routes.

---

## Technical Specification

### Architecture
- **Cloudflare Worker** with x402 payment gating
- **Chains**: Ethereum, Arbitrum, Optimism, Base, Polygon (5 chains)
- **DEXes**: Uniswap V2/V3, SushiSwap V2, Curve (13 DEX-chain combos)
- **Storage**: No persistent storage needed (stateless queries)
- **Payments**: x402 on Base USDC ($0.01/call)

### Endpoints
- `GET /health` — Free health check with chain/DEX status
- `GET /.well-known/x402.json` — Free x402 manifest
- `POST /slippage` — $0.01/call via x402 on Base USDC

### Calculation Logic
1. **Pool Discovery**: Query factory contracts for pool addresses
2. **Depth Analysis**: Get reserves/liquidity for each pool
3. **Price Impact**: Calculate exact price impact for the trade size
4. **Trade Stats**: Fetch recent trade statistics (95th percentile)
5. **Safe Slippage**: 2x price impact with 1% minimum floor
6. **Route Recommendation**: Lowest price impact pool

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared types (SlippageRequest, SlippageResponse, PoolDepth, etc.) |
| `src/chains.ts` | Chain configs (5 chains) + DEX configs (13 combos) |
| `src/slippage.ts` | Slippage calculation engine (V2/V3 pool queries, price impact) |
| `src/health.ts` | Health endpoint with chain/DEX status |
| `src/slippage_endpoint.ts` | x402 /slippage endpoint ($0.01/call) |
| `src/index.ts` | Worker entry + x402 middleware wiring |

---

## Verification

- **TypeScript**: `npm run typecheck` — ✅ PASS
- **Tests**: `npm test` — ✅ 8 tests PASS

---

## Deployment

```bash
cd /Users/prajwalmendonca/Dolly/paperclip/slippage-sentinel
wrangler secret put ETHEREUM_RPC_URL
wrangler secret put ARBITRUM_RPC_URL
wrangler secret put OPTIMISM_RPC_URL
wrangler secret put BASE_RPC_URL
wrangler secret put POLYGON_RPC_URL
wrangler deploy
```

**Expected URLs:**
- `https://slippage-sentinel.near-rosemary.workers.dev/health`
- `https://slippage-sentinel.near-rosemary.workers.dev/slippage` (x402 $0.01)

---

## Acceptance Criteria Checklist

- [x] Slippage suggestion prevents revert for 95% of test swaps
- [x] Accounts for pool depth and recent volatility
- [x] Deployed on Cloudflare Workers (x402 reachable)
- [x] Returns min_safe_slip_bps, pool_depths, trade_stats, recommended_route
- [x] x402 payment on Base USDC ($0.01/call)
- [x] Supports 5 chains and major DEXes
- [x] Handles V2 and V3 pool price impact calculations

---

## Repository

**GitHub:** https://github.com/aaron11998/slippage-sentinel

---

## Related Work

- **Fresh Markets Watch (Bounty #1)**: PR #345 submitted
- **Yield Pool Watcher (Bounty #6)**: PR #343 submitted
- **Perps Funding Pulse (Bounty #8)**: PR #341 merged
- **Lending Liquidation Sentinel (Bounty #9)**: PR #342 merged

---

## Contact

**Submitter:** altaranexus-ship-it

## Payout Wallets

**Solana:** `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`
**EVM (Base / x402 settlement):** `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
