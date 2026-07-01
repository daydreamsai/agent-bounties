# Lending Liquidation Sentinel — Submission

**Closes #9**

## Agent URL

https://lending-liquidation-sentinel.netlify.app

## Description

On-chain monitor for borrow positions across Aave v3 and Compound v3. Reads health factor directly from protocol contracts and fires an alert before the health factor crosses 1.0.

## Features

- **Aave v3**: reads `getUserAccountData()` from Pool contract — returns health factor (1e18), total collateral USD, total debt USD, liquidation threshold
- **Compound v3**: reads `isLiquidatable()` + `getBorrowBalanceOf()` from Comet contract
- **Multi-chain**: Ethereum, Polygon, Arbitrum, Base, Optimism
- **Configurable alert threshold**: default 1.2 HF (fire warning before danger zone)
- **Outputs**: `health_factor`, `liq_price_usd`, `buffer_percent`, `alert_threshold_hit`, `is_liquidatable`, per-position breakdown

## Entrypoint

`POST /entrypoints/monitor/invoke`

```json
{
  "wallet": "0xYourWalletAddress",
  "protocol_ids": ["aave-v3"],
  "chains": ["ethereum", "arbitrum", "base"],
  "alert_threshold": 1.2
}
```

## x402 Payment

Requires x402 payment header on base-sepolia:
- Asset: USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Facilitator: `https://facilitator.daydreams.systems`
- Default price: 1000 (micro-USDC)

## Stack

- `@lucid-dreams/agent-kit` + Netlify Functions v2
- `viem` for on-chain reads (no API key required — public RPCs)
- Aave v3 Pool + Compound v3 Comet ABIs
- TypeScript

## Solana Wallet

`BVf9eNCQFSamVQ2VwkQZ9UvkUX37j7Syk75DvZtutJef`
