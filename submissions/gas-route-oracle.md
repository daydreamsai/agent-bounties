# Bounty Submission

## Related Issue: [#4](https://github.com/daydreamsai/agent-bounties/issues/4)

## Agent Description

**GasRoute Oracle** recommends the cheapest execution route across Ethereum, Base, Arbitrum, and BNB Smart Chain. It returns native/USD fee estimates, congestion level, and priority fee hints backed by real-time gas feeds.

## Live Link

Deployment URL: https://gasroute-oracle-production.up.railway.app/
Manifest: https://gasroute-oracle-production.up.railway.app/.well-known/agent.json

## Acceptance Criteria

- [x] Meets all technical specifications in the bounty issue
- [x] Deployed on a publicly reachable domain
- [x] x402 payments enabled (`0.02 USDC` invoke price)
- [x] Entrypoint returns best chain recommendation with fee + congestion hints
- [x] Submission file added to `submissions/` directory

## Other Resources

Repository: https://github.com/basstimam/gasroute-oracle
Documentation: [README.md](README.md)
Demo Video: N/A
Other: Includes helper script `bun run pay` for testing paid requests

## Wallet

EVM Wallet Address: 0x892e4feed0128f11d486fd451aff4a78171c8748 (pool, used on production)
Solana Address: 9Bxn6CsqLcciGWVuPcwTVp7oyEVi815Y9Nx7TLg22Hp7

## Additional Notes

- Gas data sourced from Blocknative, Base Gas API, Arbitrum API/RPC, and Etherscan v2 for BSC.
- Unit tests (`bun test`) cover route selection and congestion scoring.
- Manifest regenerated with production `API_BASE_URL` before deployment.
