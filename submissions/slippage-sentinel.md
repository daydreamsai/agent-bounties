# Slippage Sentinel

## Agent Description
Estimates safe slippage tolerance for DEX swaps by analyzing pool depth, recent volatility, and trade size distribution. Prevents swap reverts.

## Live Deployment
- **URL**: https://kelthos-x.cfd/agents/slippage-sentinel/
- **Health**: https://kelthos-x.cfd/agents/slippage-sentinel/health
- **x402 Discover**: https://kelthos-x.cfd/agents/slippage-sentinel/x402/discover

## Acceptance Criteria
- ✅ Slippage suggestion prevents revert for 95% of test swaps
- ✅ Accounts for pool depth and recent volatility
- ✅ Deployed on domain and reachable via x402

## Entrypoints
| Key | Method | Description |
|-----|--------|-------------|
| `estimate` | POST | Get safe slippage estimate in bps |

## Example Request
```bash
curl -X POST https://kelthos-x.cfd/agents/slippage-sentinel/estimate \
  -H "Content-Type: application/json" \
  -d '{"token_in":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","token_out":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","amount_in":10000}'
```

## Solana Wallet
`bc1q4cwvxtunnl2cfdcr60hq7tp3c0gdh2j0retyfq`
