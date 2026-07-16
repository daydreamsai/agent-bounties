# Slippage Sentinel

**Bounty Issue**: [Slippage Sentinel · #3](https://github.com/daydreamsai/agent-bounties/issues/3)

## Agent Description

Slippage Sentinel estimates the minimum safe slippage tolerance for any swap route to prevent swap reverts. It considers:

- **Pool depth** (liquidity reserves)
- **Recent trading activity** (P95 trade size)
- **Volatility buffer** based on recent trade patterns
- **Gas price fluctuation buffer**

Built with [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit).

## Input

| Field | Type | Description |
|-------|------|-------------|
| `token_in` | string | Input token address |
| `token_out` | string | Output token address |
| `amount_in` | number | Amount to swap |
| `route_hint` | string (optional) | Suggested route/DEX |

## Output

| Field | Type | Description |
|-------|------|-------------|
| `min_safe_slip_bps` | number | Minimum safe slippage in basis points |
| `pool_depths` | array | Liquidity depth data for route |
| `recent_trade_size_p95` | number | 95th percentile of recent trade sizes |
| `breakdown` | object | Detailed breakdown of slippage components |

## Acceptance Criteria

- ✅ Slippage suggestion prevents revert for 95% of test swaps
- ✅ Accounts for pool depth and recent volatility
- ✅ Deployed on a public HTTPS domain and reachable via x402

## x402 Configuration

The agent enables x402 when payment environment variables are present:

| Variable | Purpose | Example |
|----------|---------|---------|
| `ADDRESS` | x402 pay-to address for settlement | `0x...` |
| `FACILITATOR_URL` | x402 facilitator URL | `https://x402.org/facilitator` |
| `NETWORK` | x402 network | `base` |
| `DEFAULT_PRICE` | price in USDC base units | `10000` |
| `AGENT_DOMAIN` | public HTTPS domain for manifests/trust metadata | `https://slippage.example.com` |

`DEFAULT_PRICE=10000` is 0.01 USDC with 6-decimal USDC. When configured, unpaid calls to `/entrypoints/estimate-slippage/invoke` should return `402 Payment Required`; paid x402 clients can settle and receive the slippage quote.

Current live x402 configuration:

- Public URL: `https://1bq26176945ii.vicp.fun`
- Manifest: `https://1bq26176945ii.vicp.fun/.well-known/agent.json`
- Invoke endpoint: `https://1bq26176945ii.vicp.fun/entrypoints/estimate-slippage/invoke`
- Pay-to address: `0x0F8b3d793850B275E55037ed3b069Bd2ebBAd124`
- Network: `base`
- Facilitator: `https://x402.org/facilitator`
- Price: `10000` USDC base units

## Solana Wallet

`TODO: fill wallet address`

## Deployment

Deployed at: `https://1bq26176945ii.vicp.fun`

Public verification:

```bash
curl -i https://1bq26176945ii.vicp.fun/health
curl -i https://1bq26176945ii.vicp.fun/entrypoints
curl -i https://1bq26176945ii.vicp.fun/.well-known/agent.json
curl -i -X POST https://1bq26176945ii.vicp.fun/entrypoints/estimate-slippage/invoke \
  -H 'content-type: application/json' \
  -d '{"input":{"token_in":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","token_out":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","amount_in":1000,"route_hint":"Uniswap V3"}}'
```

The unpaid invoke request returns `402 Payment Required` with an x402 accept object whose `resource` is `https://1bq26176945ii.vicp.fun/entrypoints/estimate-slippage/invoke`.

Deployment instructions: see [`DEPLOYMENT.md`](../DEPLOYMENT.md).

## Resources

- [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit)
