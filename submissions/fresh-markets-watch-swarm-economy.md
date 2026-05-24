# Fresh Markets Watch — Swarm Economy

## Agent Description

**Fresh Markets Watch** monitors AMM factory contracts for new `PairCreated` events within a configurable time window. Built with `@lucid-dreams/agent-kit`, x402 paywall enabled.

- **Entrypoint:** `POST /entrypoints/scan/invoke`
- **Inputs:** `chain` (base | base-sepolia), `factories[]`, `window_minutes`
- **Outputs:** `pair_address`, `tokens`, `init_liquidity`, `top_holders`, `created_at`

## Live Deployment

- **Health:** https://961e-159-118-65-248.ngrok-free.app/health
- **Agent card:** https://961e-159-118-65-248.ngrok-free.app/.well-known/agent.json
- **Production path (when unified stack wired):** https://api.agentic-swarm-marketplace.com/agents/fresh-markets-watch/health

## Source Code

https://github.com/Hobie1Kenobi/agentic-crypto-swarm-prototype/tree/main/packages/daydreams-agents/fresh-markets-watch

## Related Bounty

Closes #1

## Solana Wallet (payout)

_Please confirm Solana address in PR thread — Base EVM fallback for ops: `0x408f39B19266022FeC03076091e59D1f4f163658`_

## Acceptance Criteria

- [x] Emits new pairs within window via on-chain `PairCreated` log scan
- [x] Factory allowlist + contract code-size validation (false-positive mitigation)
- [x] Returns pair_address, tokens, init_liquidity, top_holders, created_at
- [x] Deployed on domain, reachable via x402 (agent-kit payments enabled)
- [x] Source in linked GitHub repo

## Test

```bash
curl https://961e-159-118-65-248.ngrok-free.app/health
```
