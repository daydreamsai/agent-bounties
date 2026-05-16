# Bounty Submission: Lending Liquidation Sentinel

**Issue**: [#9 - Lending Liquidation Sentinel](https://github.com/daydreamsai/agent-bounties/issues/9)
**Author**: billbtbillb-ui
**Date**: 2026-05-15

## What I Built

A lending liquidation sentinel agent that:

- Monitors Aave V3 and Compound V3 borrow positions
- Computes health factors, liquidation prices, and buffer percentages
- Classifies risk levels (safe / warning / danger / critical)
- Simulates price crash scenarios ("what if ETH drops 30%?")
- Runs standalone or as a Daydreams/Lucid agent

## Key Files

- `src/calculations.ts` — Core math (HF, liq price, buffer, risk classification)
- `src/types.ts` — Type definitions
- `src/index.ts` — Agent with `check_health` and `simulate` entrypoints
- `tests/calculations.test.ts` — 15 tests covering all calculations

## Usage

```typescript
import { checkHealth, simulate } from "./src/index.js";

const result = await checkHealth({
  wallet: "0x...",
  protocols: ["aave-v3"],
  positions: [{
    protocol: "aave-v3",
    chain: "ethereum",
    collateralAsset: "ETH",
    collateralAmount: 10,
    collateralPriceUsd: 3000,
    borrowAsset: "USDC",
    borrowAmount: 15000,
    borrowPriceUsd: 1,
    liquidationThreshold: 0.85,
    ltv: 0.80,
  }],
});

// Simulate 30% ETH crash
const sim = await simulate({
  wallet: "0x...",
  protocols: ["aave-v3"],
  positions: [/* ... */],
  simulate: { crashPercent: 30 },
});
```
