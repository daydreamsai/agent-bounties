# Slippage Sentinel Submission

## Agent Details

- **Name**: Slippage Sentinel
- **Description**: Estimate safe slippage tolerance for any route to prevent swap reverts
- **Bounty Issue**: https://github.com/daydreamsai/agent-bounties/issues/3
- **Solana Wallet**: C6yGDHz4vRJTNKsH72cth3wf2uSETA5rBwD64SGEZx3h

## Implementation

The agent provides safe slippage tolerance recommendations for swap routes to prevent reverts.

### Entrypoints

1. **echo** - Echo input text (for testing)
2. **slippage-recommendation** - Get safe slippage tolerance for a swap route

### Input Schema

- : Input token address
- : Output token address
- : Amount to swap
- : Suggested route/DEX

### Output Schema

- : Slippage recommendation object with:
  - : Minimum safe slippage in basis points
  - : Array of pool depth data with:
    - : Token address
    - : Liquidity in USD
    - : Depth in basis points
  - : 95th percentile of recent trade sizes

## Deployment

- **Repository**: https://github.com/ai-developer-010-plantecs-ai/ralph-agent-bounties
- **Source Code**: `daydreams-agent/slippage-sentinel/src/lib/agent.ts`
- **API**: Agent follows `@lucid-agents/core` and `@lucid-agents/hono` patterns
- **x402 Support**: Agent includes payment entrypoints via `@lucid-agents/payments`

## Acceptance Criteria Checklist

- [x] Slippage suggestion logic implemented (mock data, ready for real API integration)
- [x] Accounts for pool depth and recent volatility (simulated data)
- [x] Agent follows the agent-kit structure with proper entrypoints
- [x] Submission file created in `submissions/slippage-sentinel.md`

## Next Steps

1. Deploy the agent to a production server
2. Ensure x402 integration is configured
3. Replace mock pool data with real DEX APIs (Uniswap V3, SushiSwap, 1inch, etc.)
4. Submit PR linking to issue #3

## Resources Used

- `@lucid-agents/core` - Agent core functionality
- `@lucid-agents/hono` - HTTP server and entrypoints
- `@lucid-agents/payments` - x402 payment support
- `zod` - Input validation
