# Cross DEX Arbitrage Alert - Submission

## Bounty Issue
[Cross DEX Arbitrage Alert #2](https://github.com/daydreamsai/agent-bounties/issues/2)

## Agent Description

An autonomous agent that detects cross-DEX token price spreads across multiple chains, identifying profitable arbitrage opportunities after accounting for gas costs and DEX fees. The agent queries on-chain quotes from multiple DEXs, calculates net spreads in basis points, and returns the optimal arbitrage route along with alternative profitable routes.

### Features
- Multi-chain DEX quote aggregation
- Gas cost estimation per chain
- DEX fee accounting (Uniswap V2/V3, SushiSwap, PancakeSwap, etc.)
- Net spread calculation in basis points
- Route ranking by profitability
- x402-compatible endpoint

## Live Deployment

**Domain:** `https://cross-dex-arbitrage-alert.vercel.app`

**x402 Endpoint:** `https://cross-dex-arbitrage-alert.vercel.app/api/x402`

## Acceptance Criteria Checklist

- [x] Spread and cost calculations match on-chain quotes within 1%
- [x] Accounts for gas costs and DEX fees
- [x] Deployed on a domain and reachable via x402

## Technical Implementation

### Entrypoint: `detect-arbitrage`

**Input Schema:**
