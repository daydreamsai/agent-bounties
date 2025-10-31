# Bounty Submission

## Related Issue: [#2](https://github.com/daydreamsai/agent-bounties/issues/2)

## Agent Description

**Cross-DEX Arbitrage Alert** detects profitable arbitrage opportunities across multiple DEXs on Ethereum, Base, and BSC. It analyzes token price spreads, accounts for DEX fees and gas costs, then returns the best arbitrage route with net spread in basis points and estimated fill costs.

## Live Link

Deployment URL: https://crossdex-arbitrage-alert.vercel.app/
Manifest: https://crossdex-arbitrage-alert.vercel.app/.well-known/agent.json

## Acceptance Criteria

* [x] Meets all technical specifications in the bounty issue
* [x] Deployed on a publicly reachable domain
* [x] x402 payments enabled (`0.02 USDC` invoke price)
* [x] Entrypoint returns best route, alternative routes, net spread BPS, and estimated fill cost
* [x] Submission file added to `submissions/` directory

## Other Resources

Repository: https://github.com/basstimam/crossdex-arbitrage-alert
Documentation: [README.md](https://github.com/basstimam/crossdex-arbitrage-alert/blob/master/README.md)
Demo Video: (https://youtu.be/gv_qIFrB1Z4)
x402scan : https://www.x402scan.com/server/04fcd863-6972-4a71-916d-1fd95f76f7d9
Other: Includes helper scripts `bun run pay` and `bun run call` for testing paid/unpaid requests

## Wallet

EVM Wallet Address: 0x892e4feed0128f11d486fd451aff4a78171c8748 (used for payments and production)
Solana Wallet Address: 9Bxn6CsqLcciGWVuPcwTVp7oyEVi815Y9Nx7TLg22Hp7

## Additional Notes

* Supports Ethereum, Base, and BSC with multiple DEXs (Uniswap, SushiSwap, Aerodrome, PancakeSwap, etc.)
* Gas cost calculations per chain (Ethereum: 25 gwei, Base: 1 gwei, BSC: 5 gwei)
* DEX fee accounting (0.1% - 0.3% depending on DEX)
* Realistic fallback pricing with DEX variations when live quotes unavailable
