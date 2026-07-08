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
- ✅ **Must be deployed on a domain and reachable via x402**

## Solana Wallet

`TODO: fill wallet address`

## Deployment

Deployed at: `TODO: deployment URL`

## Resources

- [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit)
