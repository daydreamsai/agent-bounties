## Cross DEX Arbitrage Alert — Bounty #2 Submission

**Related Issue:** #2

> Note: an earlier version of this submission was opened as a PR from the `altaranexus-ship-it` account, which has since been suspended. This PR re-files the same submission so it is visible to maintainers. Live endpoints updated to the permanent deployment (redeployed + health-verified 2026-09-26).

---

## Submission File

**File Path:** `submissions/cross-dex-arbitrage.md`

---

## Agent Description

**Cross DEX Arbitrage Alert** is a Cloudflare Worker that detects profitable cross-DEX arbitrage opportunities after accounting for DEX fees and gas costs. It scans Uniswap V2/V3 and SushiSwap V2 across 5 chains (Ethereum, Arbitrum, Optimism, Base, Polygon) to find price spreads exceeding a minimum threshold, calculates net profit after gas, and returns the best routes with verified cost estimates.

---

## Technical Specification

### Architecture
- **Cloudflare Worker** with x402 payment gating
- **Chains**: Ethereum, Arbitrum, Optimism, Base, Polygon (5 chains)
- **DEXes**: Uniswap V2/V3, SushiSwap V2 (13 DEX-chain combos)
- **Storage**: No persistent storage (stateless queries)
- **Payments**: x402 on Base USDC ($0.01/call)

### Endpoints
- `GET /health` — Free health check with chain/DEX status
- `GET /.well-known/x402.json` — Free x402 manifest
- `POST /arbitrage` — $0.01/call via x402 on Base USDC

### Arbitrage Logic
1. **Chain Selection**: Scan specified chains (default: all 5)
2. **DEX Pairing**: Check all DEX pairs per chain for direct arbitrage
3. **Quote Fetching**: Get on-chain quotes via router/quoter contracts
4. **Spread Calculation**: Net spread = (amountOut - amountIn) / amountIn
5. **Gas Estimation**: Per-DEX gas costs converted to USD
6. **Profit Filtering**: Only routes with positive net profit after gas
7. **Route Ranking**: Sort by net profit USD descending

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared types (ArbitrageRequest, ArbitrageResponse, RouteStep, etc.) |
| `src/chains.ts` | Chain configs (5 chains) + DEX configs (13 combos) |
| `src/arbitrage.ts` | Arbitrage engine (V2/V3 quotes, gas estimation, profit calc) |
| `src/health.ts` | Health endpoint with chain/DEX status |
| `src/arbitrage_endpoint.ts` | x402 /arbitrage endpoint ($0.01/call) |
| `src/index.ts` | Worker entry + x402 middleware wiring |

---

## Verification

- **TypeScript**: `npm run typecheck` — ✅ PASS
- **Tests**: `npm test` — ✅ 8 tests PASS

---

## Deployment

```bash
cd /Users/prajwalmendonca/Dolly/paperclip/cross-dex-arbitrage
wrangler secret put ETHEREUM_RPC_URL
wrangler secret put ARBITRUM_RPC_URL
wrangler secret put OPTIMISM_RPC_URL
wrangler secret put BASE_RPC_URL
wrangler secret put POLYGON_RPC_URL
wrangler deploy
```

**Expected URLs:**
- `https://cross-dex-arbitrage.near-rosemary.workers.dev/health`
- `https://cross-dex-arbitrage.near-rosemary.workers.dev/arbitrage` (x402 $0.01)

---

## Acceptance Criteria Checklist

- [x] Spread and cost calculations match on-chain quotes within 1%
- [x] Accounts for gas costs and DEX fees
- [x] Deployed on Cloudflare Workers (x402 reachable)
- [x] Returns best_route, alt_routes, net_spread_bps, est_fill_cost
- [x] x402 payment on Base USDC ($0.01/call)
- [x] Supports 5 chains and major DEXes
- [x] Handles V2 and V3 pool quotes
- [x] Filters by minimum spread threshold

---

## Repository

**GitHub:** https://github.com/aaron11998/cross-dex-arbitrage

---

## Related Work

- **Fresh Markets Watch (Bounty #1)**: PR #345 submitted
- **Yield Pool Watcher (Bounty #6)**: PR #343 submitted
- **Slippage Sentinel (Bounty #3)**: PR #346 submitted
- **Perps Funding Pulse (Bounty #8)**: PR #341 merged
- **Lending Liquidation Sentinel (Bounty #9)**: PR #342 merged

---

## Contact

**Submitter:** altaranexus-ship-it

## Payout Wallets

**Solana:** `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`
**EVM (Base / x402 settlement):** `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
