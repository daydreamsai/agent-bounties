# Slippage Sentinel Agent

Estimates safe slippage for DEX swap routes based on liquidity and trade size.

## Endpoints

### POST /estimate
Estimate slippage for a swap route.

```json
{
  "token_in": "0x...",
  "token_out": "0x...",
  "amount_in": 1000,
  "pool_liquidity": 5000000,
  "dex": "uniswap_v3"
}
```

### GET /estimate
x402 compatible GET endpoint.

```
/estimate?token_in=0x...&token_out=0x...&amount_in=1000&pool_liquidity=5000000&dex=uniswap_v3
```

## Output

```json
{
  "estimated_slippage_bps": 45.5,
  "recommended_slippage_bps": 68.25,
  "price_impact_bps": 30.0,
  "liquidity_utilization": 0.02,
  "risk_level": "low",
  "route": {...}
}
```

## Risk Levels

- **low**: <50 bps recommended slippage
- **medium**: 50-200 bps
- **high**: 200-500 bps
- **extreme**: >500 bps
