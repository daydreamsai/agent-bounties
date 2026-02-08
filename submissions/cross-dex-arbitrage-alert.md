# Cross DEX Arbitrage Alert — Bounty #2

## Agent
`agents/cross-dex-arbitrage-alert/`

## Description
Real-time cross-DEX arbitrage detection agent that queries on-chain quoter contracts across multiple DEXes and chains to identify price spreads and profitable swap opportunities.

## Features
- **Multi-DEX**: Uniswap V3, SushiSwap V3, Aerodrome
- **Multi-Chain**: Base, Ethereum, Arbitrum, Optimism
- **3 Entrypoints**:
  - `scan` — raw address-based scanning
  - `scan_named` — symbol-based scanning (WETH, USDC, etc.)
  - `triangular_scan` — A→B→C→A triangular arb detection
- **On-chain quotes**: Uses actual DEX quoter contracts for accurate pricing
- **Gas-aware**: Estimates gas costs per chain and factors into profitability
- **Fee-aware**: Tests all fee tiers (1bp, 5bp, 30bp, 100bp)

## Technical Details
- Built with `@lucid-dreams/agent-kit`
- Uses `viem` for on-chain calls
- Queries Uniswap V3 QuoterV2 contracts via `quoteExactInputSingle`
- Spread calculated in basis points between best/worst quotes
- Supports 4 chains and 8+ DEX deployments

## Acceptance Criteria
- ✅ Spread and cost calculations match on-chain quotes within 1% (uses actual quoter contracts)
- ✅ Accounts for gas costs and DEX fees
- ✅ Deployed and reachable via x402
