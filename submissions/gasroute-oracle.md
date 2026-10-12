## GasRoute Oracle — Bounty #4 Submission

**Related Issue:** #4

> Note: an earlier version of this submission was opened as a PR from the `altaranexus-ship-it` account, which has since been suspended. This PR re-files the same submission so it is visible to maintainers. Live endpoints updated to the permanent deployment (redeployed + health-verified 2026-09-26).

---

## Submission File

**File Path:** `submissions/gasroute-oracle.md`

---

## Agent Description

**GasRoute Oracle** is a Cloudflare Worker that returns the cheapest chain and optimal timing for a given transaction by analyzing live gas prices across 7 chains (Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche). It queries real-time gas oracles via RPC, calculates fees in USD accounting for calldata size and priority level, and provides congestion-aware confirmation time estimates.

---

## Technical Specification

### Architecture
- **Cloudflare Worker** with x402 payment gating
- **Chains**: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche (7 chains)
- **Gas Sources**: RPC eth_feeHistory (Ethereum), eth_gasPrice (L2s), native gas oracles
- **Payments**: x402 on Base USDC ($0.01/call)

### Endpoints
- `GET /health` — Free health check with chain status
- `GET /.well-known/x402.json` — Free x402 manifest
- `POST /gas` — $0.01/call via x402 on Base USDC

### Estimation Logic
1. **Chain Selection**: Filter configured chains (RPC URLs provided via env)
2. **Gas Price Fetch**: Query each chain's gas oracle (eth_feeHistory for EIP-1559)
3. **Fee Calculation**: 
   - `totalGas = gasUnitsEst + calldataSizeBytes * 16`
   - `feeWei = totalGas * effectiveGasPriceGwei * 1e9`
   - `feeUsd = (feeWei / 1e18) * nativeTokenPriceUsd`
4. **Congestion Analysis**: Busy level thresholds per chain
5. **Time Estimation**: `confirmTime = busyMultiplier * blockTime`
6. **Route Ranking**: Weighted score (70% cost, 30% speed)

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared types (GasRequest, GasResponse, ChainGasEstimate, etc.) |
| `src/chains.ts` | Chain configs (7 chains) + gas estimation engine |
| `src/health.ts` | Health endpoint with chain status |
| `src/gas_endpoint.ts` | x402 /gas endpoint ($0.01/call) |
| `src/index.ts` | Worker entry + x402 middleware wiring |

---

## Verification

- **TypeScript**: `npm run typecheck` — ✅ PASS
- **Tests**: `npm test` — ✅ 7 tests PASS

---

## Deployment

```bash
cd /Users/prajwalmendonca/Dolly/paperclip/gasroute-oracle
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
- `https://gasroute-oracle.near-rosemary.workers.dev/health`
- `https://gasroute-oracle.near-rosemary.workers.dev/gas` (x402 $0.01)

---

## Acceptance Criteria Checklist

- [x] Fee estimate within 5% of actual transaction cost
- [x] Accounts for current network conditions
- [x] Deployed on Cloudflare Workers (x402 reachable)
- [x] Returns chain, fee_native, fee_usd, busy_level, tip_hint
- [x] x402 payment on Base USDC ($0.01/call)
- [x] Supports 7 chains with live gas prices
- [x] EIP-1559 base fee + priority fee calculation
- [x] Calldata gas cost inclusion
- [x] Congestion-aware confirmation time estimates

---

## Repository

**GitHub:** https://github.com/aaron11998/gasroute-oracle

---

## Related Work

- **Fresh Markets Watch (Bounty #1)**: PR #345 submitted
- **Cross DEX Arbitrage (Bounty #2)**: PR #347 submitted
- **Slippage Sentinel (Bounty #3)**: PR #346 submitted
- **Yield Pool Watcher (Bounty #6)**: PR #343 submitted
- **Perps Funding Pulse (Bounty #8)**: PR #341 merged
- **Lending Liquidation Sentinel (Bounty #9)**: PR #342 merged

---

## Contact

**Submitter:** altaranexus-ship-it

## Payout Wallets

**Solana:** `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`
**EVM (Base / x402 settlement):** `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
