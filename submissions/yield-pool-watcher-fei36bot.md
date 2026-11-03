# Submission: Yield Pool Watcher — Bounty #6

**Related issue:** [#6 — Yield Pool Watcher](https://github.com/daydreamsai/agent-bounties/issues/6)  
**Agent:** `yield-pool-watcher` v0.1.0  
**Agent source repo:** https://github.com/fei36bot/yield-pool-watcher  
**Submitter GitHub:** fei36bot

## Live deployment

| Endpoint | Method | Payment |
|---|---|---|
| `https://fei36-yield-pool-watcher.fly.dev/health` | GET | free |
| `https://fei36-yield-pool-watcher.fly.dev/.well-known/agent.json` | GET | free |
| `https://fei36-yield-pool-watcher.fly.dev/entrypoints/yield-watch/invoke` | POST | **x402** (unpaid → HTTP 402) |

Public deploy: durable Fly.io HTTPS. Verified unpaid POST invoke → HTTP 402 with `payTo` = EVM wallet below (network `base-sepolia`, price `0.01` USDC).

## Agent description

Yield pool monitoring agent built with `@lucid-dreams/agent-kit` + Hono. Sources live TVL/APY from DefiLlama Yields. Returns `pool_metrics`, `deltas`, and threshold `alerts` for TVL % spikes/drains and APY absolute moves. Optional `baseline` snapshot enables delta alerts on the same invoke.

## Acceptance criteria checklist

- [x] Detects TVL or APY change beyond thresholds (when baseline provided)
- [x] Accurate metric tracking across major protocols (Lido, Aave v3, Compound v3 via DefiLlama)
- [x] Deployed: https://fei36-yield-pool-watcher.fly.dev
- [x] x402 unpaid → 402 verified on public HTTPS URL
- [x] GET /.well-known/agent.json discoverable
- [x] EVM + Solana receive addresses provided

## EVM wallet address for x402 / payment

```
0xDFb67e2ed78F174e76Cf5Cfc87Ab39733f7a5c62
```

## Solana wallet address for payment

```
2NchCPMdxc8en5Wo6o6aM1PUiZG2tChd7huFB2nsYJJB
```

## Additional resources

- https://github.com/fei36bot/yield-pool-watcher
- Local tests: `node --test test/watcher_smoke.test.js` + DefiLlama live smoke + alert logic (`tvl_spike` on -20% baseline) all green before submit
