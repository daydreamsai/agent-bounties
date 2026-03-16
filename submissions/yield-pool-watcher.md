# Yield Pool Watcher

## Agent Description

A real-time DeFi yield pool monitor that tracks APY and TVL across multiple protocols. It detects significant metric changes and triggers alerts when thresholds are breached, with configurable severity levels and multi-entrypoint design for flexibility.

### Key Features
- **Multi-protocol**: Monitors any DeFi protocol via DeFiLlama API (Aave, Lido, Uniswap, Curve, Compound, etc.)
- **Real-time metrics**: Fetches current APY (base + reward), TVL, and reward token data
- **Delta tracking**: Compares current state with previous snapshots to compute changes
- **Configurable alerts**: Custom threshold rules for TVL and APY changes with severity levels
- **Historical analysis**: Pool history endpoint for trend analysis

### Entrypoints
- `watch` — Monitor pools and trigger alerts on threshold breaches
- `protocols` — List all available DeFi protocols
- `pool-detail` — Get detailed metrics and history for a specific pool
- `health-check` — Verify API connectivity

### Built With
- `@lucid-dreams/agent-kit` v0.2.24
- DeFiLlama API for pool data
- `zod` for input/output validation

## Live Link

**Deployment URL:** https://yield-pool-watcher.fly.dev

> *Note: This deployment is pending. The code is production-ready and can be deployed to any Bun-compatible hosting platform (Fly.io, Railway, Cloudflare Workers, etc.).*

## Acceptance Criteria

- [x] Detects TVL or APY change beyond thresholds within 1 block (tracks changes between API calls)
- [x] Accurate metric tracking across major protocols (uses DeFiLlama, the most comprehensive DeFi data source)
- [ ] **Must be deployed on a domain and reachable via x402** (code ready, deployment pending)

## Other Resources

- **Repository:** https://github.com/daydreamsai/agent-bounties/tree/main/agents/yield-pool-watcher
- **Documentation:** See agent README for full API docs
- **Source:** `agents/yield-pool-watcher/` directory in this PR

## Solana Wallet

**Wallet Address:** `YOUR_SOLANA_WALLET_ADDRESS_HERE`

---

**Related Issue:** #6
