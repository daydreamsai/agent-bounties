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
- ⚠️ **Must be deployed on a domain and reachable via x402** — code is x402-ready via `@lucid-dreams/agent-kit`; final live URL requires a deployment target/domain and payment address configuration.

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

## Solana Wallet

`TODO: fill wallet address`

## Deployment

Deployed at: `BLOCKED: external domain and wallet/payment credentials are not available in this workspace.`

Deployment instructions: see [`DEPLOYMENT.md`](../DEPLOYMENT.md).

## Resources

- [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit)
