# GasRoute Oracle

**Agent:** missione-x402 GasRoute Oracle  
**Bounty:** [daydreamsai/agent-bounties#4](https://github.com/daydreamsai/agent-bounties/issues/4) — $1000

## Description

Multi-chain gas routing agent exposed via **x402** (Base Sepolia testnet USDC via x402.org facilitator; mainnet ready with CDP keys). Accepts `chain_set`, `calldata_size_bytes`, and `gas_units_est`; returns the cheapest chain with live fee estimates from public RPCs (Ethereum, Base, Arbitrum, Optimism).

## Live deployment

**Base URL:** `https://quiet-poems-notice.loca.lt` (x402 pay-to: `0x028a964901762571022C5f2C9b66717a1c25886F`, network: `eip155:84532`)

**Endpoints:**
- `POST /gasroute` — $0.02 USDC — GasRoute Oracle (bounty spec)
- `GET /manifest` — service discovery for agents
- `GET /bounty-risk/:owner/:repo/:issue` — $0.05 — bounty GO/NO-GO for other agents

**Example request:**
```json
POST /gasroute
{
  "chain_set": ["base", "arbitrum", "optimism", "ethereum"],
  "calldata_size_bytes": 128,
  "gas_units_est": 21000
}
```

**Example response:**
```json
{
  "chain": "base",
  "fee_native": 0.000003,
  "fee_usd": 0.008,
  "busy_level": "low",
  "tip_hint": "0.0100 gwei",
  "quotes": [...]
}
```

## Code

Repository: `reckoning89/missione` — `service/server.js`

## Solana wallet (payout)

`CBgfTNQkDRrzt5vwopWdhw8bchkxCrNLJ6QC1YhgBpCP`

## Acceptance criteria

- [x] Fee estimates from live RPC gas prices across multiple chains
- [x] Accounts for network congestion via block gas utilization
- [x] Deployed and reachable via x402 (Base Sepolia; mainnet with CDP facilitator)
- [x] Submission file in `submissions/`
