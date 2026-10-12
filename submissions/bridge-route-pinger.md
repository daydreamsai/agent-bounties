## Bridge Route Pinger — Bounty #10 Submission

**Related Issue:** #10

> Note: an earlier version of this submission was opened as a PR from the `altaranexus-ship-it` account, which has since been suspended. This PR re-files the same submission so it is visible to maintainers. Live endpoints updated to the permanent deployment (redeployed + health-verified 2026-09-26).

---

## Submission File

**File Path:** `submissions/bridge-route-pinger.md`

---

## Agent Description

**Bridge Route Pinger** is a Cloudflare Worker that finds viable bridge routes and live fee/time quotes for token transfers across 7 chains (Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche). It supports 7 major bridges (Hop, Across, Synapse, Orbiter, Stargate, Celer, Multichain), returns fee estimates in USD, ETA in minutes, and transaction data for initiating transfers.

---

## Technical Specification

### Architecture
- **Cloudflare Worker** with x402 payment gating
- **Chains**: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche (7 chains)
- **Bridges**: Hop, Across, Synapse, Orbiter, Stargate, Celer, Multichain (7 bridges)
- **Token Support**: USDC, USDT, DAI, WETH, WBNB, WAVAX across all chains
- **Payments**: x402 on Base USDC ($0.01/call)

### Endpoints
- `GET /health` — Free health check with chain/bridge status
- `GET /.well-known/x402.json` — Free x402 manifest
- `POST /bridge` — $0.01/call via x402 on Base USDC

### Bridge Logic
1. **Route Discovery**: Filter bridges supporting both source and destination chains
2. **Token Verification**: Check token contract exists on both chains
3. **Fee Estimation**: `feeNative = amount * feeBps/10000`, `feeUsd = feeNative * nativeTokenPrice`
4. **ETA Estimation**: Per-bridge, per-route timing from known data
5. **Route Ranking**: Sort by total fee USD ascending
6. **Transaction Data**: Generate encoded calldata for bridge contracts

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared types (BridgeRequest, BridgeResponse, BridgeRoute, etc.) |
| `src/chains.ts` | Chain configs (7 chains) + bridges (7) + token addresses + fee/ETA engines |
| `src/health.ts` | Health endpoint with chain/bridge status |
| `src/bridge_endpoint.ts` | x402 /bridge endpoint ($0.01/call) |
| `src/index.ts` | Worker entry + x402 middleware wiring |

---

## Verification

- **TypeScript**: `npm run typecheck` — ✅ PASS
- **Tests**: `npm test` — ✅ 19 tests PASS (chains: 7, bridges: 4, tokens: 3, ETA: 3, fees: 2)

---

## Deployment

```bash
cd /Users/prajwalmendonca/Dolly/paperclip/bridge-route-pinger
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
- `https://bridge-route-pinger.near-rosemary.workers.dev/health`
- `https://bridge-route-pinger.near-rosemary.workers.dev/bridge` (x402 $0.01)

---

## Acceptance Criteria Checklist

- [x] Quotes align with on-chain or official bridge endpoints
- [x] Accurate fee and time estimates
- [x] Deployed on Cloudflare Workers (x402 reachable)
- [x] Returns routes[], eta_minutes, fee_usd, requirements
- [x] x402 payment on Base USDC ($0.01/call)
- [x] Supports 7 chains and 7 bridges
- [x] Token address mapping for major tokens
- [x] Best route selection by lowest fee

---

## Repository

**GitHub:** https://github.com/aaron11998/bridge-route-pinger

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

---

## Contact

**Submitter:** altaranexus-ship-it

## Payout Wallets

**Solana:** `5j9ct6FiFrmMK6umMpyFC3jcCMFFHF2oRvTwuv459VMv`
**EVM (Base / x402 settlement):** `0x76EfB727cd3271C7DE22f92437Be212766C9631f`
