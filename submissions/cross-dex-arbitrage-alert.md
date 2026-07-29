# Cross DEX Arbitrage Alert — Bounty Submission

## Agent Name
**cross-dex-arbitrage-alert**

## Description

Detects cross-DEX token price spreads across 6 EVM chains (Ethereum, Polygon, Arbitrum, Optimism, Base, BSC). Queries live `getAmountsOut` on V2-style DEX routers, compares prices across DEXs on the same chain, and calculates net spread (basis points) after gas costs.

**Problem solved**: DeFi traders need real-time detection of profitable arbitrage opportunities between DEXs. This agent queries on-chain liquidity pools directly, compares output amounts, factors in gas costs, and returns the best route + alternatives.

## Technical Approach
- **Agent Kit**: @lucid-dreams/agent-kit v0.2.24 with Hono
- **Payment**: x402 middleware via x402-hono
- **Chains scanned**: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC
- **DEXs per chain**:
  - Ethereum: Uniswap V2, SushiSwap V2
  - Polygon: QuickSwap, SushiSwap V2
  - Arbitrum: Uniswap V2, SushiSwap V2
  - Optimism: Uniswap V2
  - Base: Uniswap V2, SushiSwap V2
  - BSC: PancakeSwap V2, Biswap
- **Detection logic**:
  - Calls `getAmountsOut(amountIn, [tokenIn, tokenOut])` on each DEX router via ethers v6
  - Compares output amounts across DEXs on the same chain
  - Calculates spread in basis points: `(sellAmt - buyAmt) * 10000 / buyAmt`
  - Estimates gas cost (300K gas units × chain gas price)
  - Flags profitable if spread > 50 bps AND gas < $50
- **Output**: `bestRoute`, `altRoutes[]`, `summary{}`

## Live Deployment
**Production URL**: https://cross-dex-arbitrage.vercel.app

**Endpoints verified**:
- `GET https://cross-dex-arbitrage.vercel.app/health` → `{"ok":true,"version":"1.0.0",...}`
- `POST https://cross-dex-arbitrage.vercel.app/entrypoints/scan/invoke` → returns full arbitrage scan result

## Acceptance Criteria Checklist
- [x] Input: token_in, token_out, amount_in, chains
- [x] Output: best_route, alt_routes[], net_spread_bps, est_fill_cost
- [x] Spread and cost calculations from on-chain quotes (getAmountsOut)
- [x] Accounts for gas costs (gas units × chain gas price) and DEX fees (0.3% V2 swap fee built into getAmountsOut)
- [x] Deployed on domain (Vercel)
- [x] Reachable via x402 (x402-hono middleware configured)
- [x] Built with @lucid-dreams/agent-kit
- [x] TypeScript, compiles clean (tsc --noEmit passes)

## Solana Wallet for Payment
`CLpp9dZzBhAgZ316szi67Nas4AdMN4Cp6Ldy1FRuBEzr`

## Other Resources
- **Repository**: https://github.com/yunaremaia/cross-dex-arbitrage
- **Agent Kit Docs**: https://www.npmjs.com/package/@lucid-dreams/agent-kit
- **x402 Spec**: https://github.com/x402-foundation/x402