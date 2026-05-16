# LP Impermanent Loss Estimator

## Agent Description

An AI agent that calculates impermanent loss (IL) estimates and fee APR for LP positions across multiple AMM types. Supports Uniswap V2 (constant product), Uniswap V3 (concentrated liquidity), Curve-like stable pools, and Balancer weighted pools.

### Features

- **Impermanent Loss Calculation**: Implements the standard V2 IL formula `2√r/(1+r) - 1` and a concentrated liquidity model for V3 positions
- **Fee APR Estimation**: Estimates annualized fee yield from pool volume, TVL, and fee tier
- **Price Ratio Analysis**: Compares entry vs. current price ratio to quantify divergence
- **Break-Even Calculation**: Binary search to find the price ratio where earned fees offset IL
- **Token-Level PnL**: Analyzes individual token positions within multi-asset pools
- **Risk Warnings**: Generates contextual alerts for severe IL, high fees, and break-even timelines

### Architecture

```
agents/lp-impermanent-loss-estimator/
├── src/
│   ├── index.ts    # Agent entrypoint (createAgentApp)
│   ├── agent.ts    # Core IL calculation logic
│   └── types.ts    # Zod schemas and TypeScript types
├── tests/
│   └── agent.test.ts  # 10+ test cases
├── package.json
└── tsconfig.json
```

### Entrypoint

- **Key**: `estimate_il`
- **Input**: `pool_address`, `token_weights`, `deposit_amounts`, `window_hours`, `pool_type`, `entry_price_ratio`, `current_price_ratio`
- **Output**: `IL_percent`, `IL_usd`, `fee_apr_est`, `volume_window`, `break_even_price_ratio`, `token_analyses[]`, `notes[]`

### Acceptance Criteria

Meets all specifications from the bounty issue:
- Computes IL for major AMM types (Uniswap V2, V3, Curve, Balancer)
- Estimates fee APR from volume and TVL data
- Includes price ratio analysis and break-even calculation
- Token-level position analysis
- Contextual warnings and notes

## Related Issue

#7 - LP Impermanent Loss Estimator

## Solana Wallet

<!-- TODO: Add your Solana wallet address -->

## Live Link

<!-- TODO: Add deployed agent URL -->

## Repository

Fork: https://github.com/billbtbillb-ui/agent-bounties
Directory: agents/lp-impermanent-loss-estimator/
