
# Bounty Submission
## Related Issue: [#3](https://github.com/daydreamsai/agent-bounties/issues/3)
## Agent Description
**Slippage Sentinel** estimates safe slippage tolerance for swap routes across Ethereum, Base, Arbitrum, BSC, Polygon, Optimism, Avalanche, and Fantom. It analyzes pool depth, trade size projections, and volatility signals to recommend minimum safe slippage BPS.

## Live Link
Deployment URL: https://slippage-sentinel.vercel.app/ 
Manifest: https://slippage-sentinel.vercel.app/.well-known/agent.json

## Acceptance Criteria
* [x]  Meets all technical specifications in the bounty issue
* [x]  Deployed on a publicly reachable domain
* [x]  x402 payments enabled (`0.02 USDC` invoke price)
* [x]  Entrypoint returns safe slippage BPS with pool metrics and volatility index
* [x]  Submission file added to `submissions/` directory

## Other Resources
Repository: https://github.com/your-repo/slippage-sentinel 
Documentation: [README.md](https://github.com/basstimam/slippage-sentinel/blob/master/README.md) 
Demo Video: (https://youtu.be/epLjory1qGE) Other: Includes helper script `bun run pay:call` for testing paid requests

## Wallet
EVM Wallet Address: 0xb308ed39d67D0d4BAe5BC2FAEF60c66BBb6AE429 (used for payments and production)
Solana Wallet Address : 9Bxn6CsqLcciGWVuPcwTVp7oyEVi815Y9Nx7TLg22Hp7

## Additional Notes
* Pool data sourced from DexScreener and GeckoTerminal APIs for multi-chain support.
* Unit tests (`bun test`) cover slippage calculation logic and API fetching.
* Manifest regenerated with production `API_BASE_URL` before deployment.
* Supports fallback from DexScreener to GeckoTerminal if pools not found.