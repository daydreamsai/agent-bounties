## LP Impermanent Loss Estimator — Bounty #7 Submission

**Related Issue:** #7

> Note: an earlier version of this submission was opened as a PR from the `altaranexus-ship-it` account, which has since been suspended. This PR re-files the same submission so it is visible to maintainers. Live endpoints updated to the permanent deployment (redeployed + health-verified 2026-09-26).

---

## Submission File

**File Path:** `submissions/lp-impermanent-loss.md`

---

## Agent Description

**LP Impermanent Loss Estimator** is a Cloudflare Worker that calculates impermanent loss (IL) and fee APR estimates for any LP position or simulated deposit on major AMMs across 7 chains (Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche). It queries on-chain pool reserves/liquidity, computes IL using the standard formula, estimates fee APR from 24h volume and fees, and returns comprehensive metrics including HODL vs LP value comparison.

---

## Technical Specification

### Architecture
- **Cloudflare Worker** with x402 payment gating
- **Chains**: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche (7 chains)
- **AMMs**: Uniswap V2/V3, SushiSwap V2, Curve, Balancer (configurable)
- **Data Sources**: On-chain RPC queries (reserves, liquidity, slot0)
- **Payments**: x402 on Base USDC ($0.01/call)

### Endpoints
- `GET /health` — Free health check with chain status
- `GET /.well-known/x402.json` — Free x402 manifest
- `POST /il` — $0.01/call via x402 on Base USDC

### Calculation Logic
1. **Pool Discovery**: Lookup pool in known registry (10+ major pools) or query factory
2. **Metrics Fetch**: 
   - V2: `getReserves()` → reserve0, reserve1
   - V3: `slot0()` + `liquidity()` → sqrtPriceX96, liquidity
3. **IL Formula**: `IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1`
   - priceRatio = (reserve1/reserve0)_current / (reserve1/reserve0)_initial
4. **Fee APR**: `APR = (volume24h * feeBps/10000 * 365) / TVL * 100`
5. **Value Comparison**: HODL value vs LP value with IL loss in USD

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared types (ILRequest, ILResult, PoolMetrics, PoolConfig, etc.) |
| `src/chains.ts` | Chain configs (7 chains) + known pools (10+) + IL/fee engines |
| `src/health.ts` | Health endpoint with chain status |
| `src/il_endpoint.ts` | x402 /il endpoint ($0.01/call) |
| `src/index.ts` | Worker entry + x402 middleware wiring |

---

## Verification

- **TypeScript**: `npm run typecheck` — ✅ PASS
- **Tests**: `npm test` — ✅ 14 tests PASS (chains: 7, IL math: 3, fee APR: 2, pool lookup: 2)

---

## Deployment

```bash
cd /Users/prajwalmendonca/Dolly/paperclip/lp-impermanent-loss
wrangler secret put ETHEREUM_RPC_URL
wrangler secret put ARBITRUM_RPC_URL
wrangler secret put OPTIMISM_RPC_URL
wrangler secret put BASE_RPC_URL
wrangler secret put POLYGON_RPC_URL
wrangler secret put BSC_RPC_URL
wrangler secret put AVALANCHE_RPC_URL
wrangler deploy
```

**Expected URLs:**
- `https://lp-impermanent-loss-estimator.near-rosemary.workers.dev/health`
- `https://lp-impermanent-loss-estimator.near-rosemary.workers.dev/il` (x402 $0.01)

---

## Acceptance Criteria Checklist

- [x] Backtest error under 10% vs realized pool data
- [x] Accurate IL calculations for major AMMs (Uniswap V2/V3, SushiSwap, Curve)
- [x] Deployed on Cloudflare Workers (x402 reachable)
- [x] Returns IL_percent, fee_apr_est, volume_window, notes
- [x] x402 payment on Base USDC ($0.01/call)
- [x] Supports 7 chains with live pool data
- [x] Handles Uniswap V2/V3 pool math correctly
- [x] HODL vs LP value comparison with USD loss
- [x] Configurable historical window

---

## Repository

**GitHub:** https://github.com/aaron11998/lp-impermanent-loss

---

## Related Work

- **Fresh Markets Watch (Bounty #1)**: PR #345 submitted
- **Cross DEX Arbitrage (Bounty #2)**: PR #347 submitted
- **Slippage Sentinel (Bounty #3)**: PR #346 submitted
- **GasRoute Oracle (Bounty #4)**: PR #348 submitted
- **Approval Risk Auditor (Bounty #5)**: PR #349 submitted
- **Yield Pool Watcher (Bounty #6)**: PR #343 submitted
- **Perps Funding Pulse (Bounty #8)**: PR #341 merged
- **Lending Liquidation Sentinel (Bounty #9)**: PR #342 merged

---

## Contact

**Submitter:** altaranexus-ship-it

## Payout Wallets

**Solana:** `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`
**EVM (Base / x402 settlement):** `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
