# Agent Bounties

Welcome to the Daydreams AI Agent Bounties program! 🚀

## About

This repository hosts bounties for building AI agents that solve real DeFi and Web3 problems. Each bounty is worth **$1,000** and is awarded on a **first-come, first-served** basis to qualifying submissions.

## Active Bounties

Browse our [open issues](https://github.com/daydreamsai/agent-bounties/issues) to see all available bounties. Each bounty includes:

- Clear specification with inputs and outputs
- Acceptance criteria
- Deployment requirements (must be reachable via x402)
- $1000 reward

### Featured Bounties

1. [Fresh Markets Watch](https://github.com/daydreamsai/agent-bounties/issues/1) - Monitor new AMM pairs
2. [Cross DEX Arbitrage Alert](https://github.com/daydreamsai/agent-bounties/issues/2) - Detect arbitrage opportunities
3. [Slippage Sentinel](https://github.com/daydreamsai/agent-bounties/issues/3) - Estimate safe slippage
4. [GasRoute Oracle](https://github.com/daydreamsai/agent-bounties/issues/4) - Find cheapest chain for transactions
5. [Approval Risk Auditor](https://github.com/daydreamsai/agent-bounties/issues/5) - Flag risky token approvals
6. [Yield Pool Watcher](https://github.com/daydreamsai/agent-bounties/issues/6) - Track APY and TVL changes
7. [LP Impermanent Loss Estimator](https://github.com/daydreamsai/agent-bounties/issues/7) - Calculate IL and fees
8. [Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8) - Fetch perpetuals funding data
9. [Lending Liquidation Sentinel](https://github.com/daydreamsai/agent-bounties/issues/9) - Monitor liquidation risk
10. [Bridge Route Pinger](https://github.com/daydreamsai/agent-bounties/issues/10) - Find best bridge routes

## How to Submit

1. **Choose a bounty** - Browse the [issues](https://github.com/daydreamsai/agent-bounties/issues) and pick one to work on
2. **Build your agent** - Use the [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit) or your preferred tools
3. **Deploy** - Your agent must be deployed on a domain and reachable via x402
3. [Slippage Sentinel](https://github.com/daydreamsai/agent-bounties/issues/3) - Estimate safe slippage
4. [GasRoute Oracle](https://github.com/daydreamsai/agent-bounties/issues/4) - Find cheapest chain for transactions
5. [Approval Risk Auditor](https://github.com/daydreamsai/agent-bounties/issues/5) - Flag risky token approvals
    - **Inputs:**
      - `token_in` - Input token address
      - `token_out` - Output token address
      - `amount_in` - Amount to swap
      - `route_hint` - Suggested route/DEX
    - **Returns:**
      - `min_safe_slip_bps` - Minimum safe slippage in basis points
      - `pool_depths` - Liquidity depth data for route
      - `recent_trade_size_p95` - 95th percentile of recent trade sizes
    - **Acceptance Criteria:**
      - Slippage suggestion prevents revert for 95% of test swaps
      - Accounts for pool depth and recent volatility
      - Must be deployed on a domain and reachable via x402
    - **Done When:**
      Agent provides slippage recommendations that demonstrably reduce swap failures.
6. [Yield Pool Watcher](https://github.com/daydreamsai/agent-bounties/issues/6) - Track APY and TVL changes
7. [LP Impermanent Loss Estimator](https://github.com/daydreamsai/agent-bounties/issues/7) - Calculate IL and fees
8. [Perps Funding Pulse](https://github.com/daydreamsai/agent-bounties/issues/8) - Fetch perpetuals funding data
- Live deployment link
- Acceptance criteria checklist
- Solana wallet address for payment
- Additional resources

## Requirements

All submissions must:

- ✅ Meet the technical specifications in the bounty issue
- ✅ Be deployed on a domain
- ✅ Be reachable via x402
- ✅ Pass all acceptance criteria

## Payment

Bounties are awarded **first-come, first-served**. The first submission that meets all requirements wins the $1,000 bounty paid to your Solana wallet.

## Resources

- [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit) - Agent development kit
- [Submissions Directory](./submissions/) - See example submissions
- [YouTube Tutorial](https://www.youtube.com/watch?v=POxLThEK_cM) - Video guide

## Questions?

Open a discussion or comment on the bounty issue if you need clarification.

---

Built with ❤️ by [Daydreams AI](https://github.com/daydreamsai)
